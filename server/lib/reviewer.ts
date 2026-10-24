import type { IndexRecord } from './types';

/**
 * Ревьюер задачи (docs/adr/0030-task-reviewer.md): кто её принимает. Явное поле
 * `reviewer` побеждает; без него — правило по видам проверок и типу изменения.
 * Чистая функция: ей хватает записей индекса и ролей манифеста.
 */

export interface ReviewerPick {
  role: string;
  /** Почему именно эта роль — показывается рядом, чтобы выбор не был магией. */
  why: string;
  explicit: boolean;
}

type Candidate = [role: string, why: string];

const BY_KIND: readonly [kind: string, role: string, why: string][] = [
  ['manual', 'analyst', 'ручная проверка — приёмка по тексту требования'],
  ['review', 'architect', 'проверка ревью — сверка с решениями и картами'],
  ['metric', 'analyst', 'метрика — сверка с целью требования']
];

const BY_CHANGE: Readonly<Record<string, Candidate>> = {
  feature: ['architect', 'новая функция — устройство кода и карты'],
  refactor: ['architect', 'рефакторинг — устройство кода и свидетельства карт']
};

const FALLBACK: readonly Candidate[] = [
  ['architect', 'запасной порядок'],
  ['developer', 'запасной порядок'],
  ['analyst', 'запасной порядок'],
  ['pm', 'запасной порядок']
];

/** Индекс записей, построенный один раз: без него каждая задача перебирает все записи заново. */
export interface RecordsLookup {
  byId: ReadonlyMap<string, IndexRecord>;
  /** Проверки по требованию, которое они проверяют (`verifies`). */
  checksByRequirement: ReadonlyMap<string, IndexRecord[]>;
}

export function buildRecordsLookup(records: readonly IndexRecord[]): RecordsLookup {
  const byId = new Map<string, IndexRecord>();
  const checksByRequirement = new Map<string, IndexRecord[]>();
  for (const record of records) {
    byId.set(record.id, record);
    if (record.type !== 'verification') continue;
    for (const id of record.links.verifies ?? []) {
      const list = checksByRequirement.get(id);
      if (list) list.push(record); else checksByRequirement.set(id, [record]);
    }
  }
  return { byId, checksByRequirement };
}

/** Проверки задачи — как у правил: свои `verified_by` и проверки её требований. */
export function taskChecks(task: IndexRecord, records: readonly IndexRecord[], lookup?: RecordsLookup): IndexRecord[] {
  const requirements = new Set(task.links.implements ?? []);
  const own = new Set(task.links.verified_by ?? []);
  if (!lookup) {
    for (const id of requirements) {
      const requirement = records.find((record) => record.id === id);
      for (const check of requirement?.links.verified_by ?? []) own.add(check);
    }
    return records.filter((record) => record.type === 'verification'
      && (own.has(record.id) || (record.links.verifies ?? []).some((id) => requirements.has(id))));
  }
  const found = new Map<string, IndexRecord>();
  for (const id of requirements) {
    for (const check of lookup.byId.get(id)?.links.verified_by ?? []) own.add(check);
    for (const check of lookup.checksByRequirement.get(id) ?? []) found.set(check.id, check);
  }
  for (const id of own) {
    const check = lookup.byId.get(id);
    if (check?.type === 'verification') found.set(check.id, check);
  }
  return [...found.values()];
}

export function reviewerOf(
  task: IndexRecord,
  records: readonly IndexRecord[],
  roles: readonly { id: string }[],
  lookup?: RecordsLookup
): ReviewerPick | null {
  const explicit = task.extra['reviewer'];
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return { role: explicit.trim(), why: 'назначен явно', explicit: true };
  }

  const known = new Set(roles.map((role) => role.id));
  // Свою работу не принимают; роль, которой в проекте нет, принять не сможет.
  const fits = (role: string) => role !== task.owner && (known.size === 0 || known.has(role));

  const kinds = new Set(taskChecks(task, records, lookup).map((check) => String(check.extra['kind'] ?? '')));
  const change = String(task.extra['change'] ?? '');
  const candidates: Candidate[] = [
    ...EXTRA_BY_KIND.filter(([kind, role]) => kinds.has(kind) && known.has(role)).map(([, role, why]): Candidate => [role, why]), ...BY_KIND.filter(([kind]) => kinds.has(kind)).map(([, role, why]): Candidate => [role, why]),
    BY_CHANGE[change] ?? ['developer', change ? `изменение ${change} — второй взгляд разработчика` : 'второй взгляд разработчика'],
    ...FALLBACK
  ];
  const found = candidates.find(([role]) => fits(role));
  return found ? { role: found[0], why: found[1], explicit: false } : null;
}

/** Название роли из манифеста; незнакомую роль показываем как есть. */
export function roleName(role: string, roles: readonly { id: string; name: string }[]): string {
  return roles.find((item) => item.id === role)?.name ?? role;
}

/**
 * Роли R-0058: приёмку вручную ведёт тестировщик, экраны и дизайн — дизайнер.
 * Берутся только если роль есть в манифесте: проект без них работает как раньше.
 * Лежит в конце файла, чтобы не сдвигать строки со свидетельствами карт.
 */
const EXTRA_BY_KIND: readonly [kind: string, role: string, why: string][] = [
  ['manual', 'qa', 'ручная проверка — приёмка тестировщиком'],
  ['design', 'designer', 'проверка дизайна — приёмка дизайнером'],
  ['screens', 'designer', 'экраны — приёмка дизайнером']
];
