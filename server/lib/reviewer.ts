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

/** Проверки задачи — как у правил: свои `verified_by` и проверки её требований. */
export function taskChecks(task: IndexRecord, records: readonly IndexRecord[]): IndexRecord[] {
  const requirements = new Set(task.links.implements ?? []);
  const own = new Set(task.links.verified_by ?? []);
  for (const id of requirements) {
    const requirement = records.find((record) => record.id === id);
    for (const check of requirement?.links.verified_by ?? []) own.add(check);
  }
  return records.filter((record) => record.type === 'verification'
    && (own.has(record.id) || (record.links.verifies ?? []).some((id) => requirements.has(id))));
}

export function reviewerOf(
  task: IndexRecord,
  records: readonly IndexRecord[],
  roles: readonly { id: string }[]
): ReviewerPick | null {
  const explicit = task.extra['reviewer'];
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return { role: explicit.trim(), why: 'назначен явно', explicit: true };
  }

  const known = new Set(roles.map((role) => role.id));
  // Свою работу не принимают; роль, которой в проекте нет, принять не сможет.
  const fits = (role: string) => role !== task.owner && (known.size === 0 || known.has(role));

  const kinds = new Set(taskChecks(task, records).map((check) => String(check.extra['kind'] ?? '')));
  const change = String(task.extra['change'] ?? '');
  const candidates: Candidate[] = [
    ...BY_KIND.filter(([kind]) => kinds.has(kind)).map(([, role, why]): Candidate => [role, why]),
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
