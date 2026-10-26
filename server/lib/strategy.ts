import { childrenIndex, effectiveOwner, leavesUnder, progressOf, type CapabilityLike, type Progress } from './functional';

/**
 * Стратегический уровень и здоровье узла (R-0084, R-0085; docs/07-maps.md,
 * «Стратегия и здоровье узла»). Стратегия — вид верхнего уровня функциональной
 * карты, а не вторая сущность. Здоровье вычисляется из четырёх сигналов —
 * прогресс, сроки, качество, нарушения — и не учитывает бюджет; ручного
 * светофора нет. Чистые функции над индексом и картой.
 */

export type HealthLevel = 'ok' | 'attention' | 'problem';
export type Signal = 'progress' | 'deadlines' | 'quality' | 'violations';

export interface HealthReason {
  signal: Signal;
  level: Exclude<HealthLevel, 'ok'>;
  text: string;
  /** Запись, к которой ведёт причина: туда проваливаются по клику. */
  recordId?: string;
}

export interface NodeHealth {
  level: HealthLevel;
  reasons: HealthReason[];
}

const RANK: Record<HealthLevel, number> = { ok: 0, attention: 1, problem: 2 };
export const worst = (a: HealthLevel, b: HealthLevel): HealthLevel => (RANK[a] >= RANK[b] ? a : b);

/** Возможность со следом карты: какая запись её объявила. */
export type StrategyCapability = CapabilityLike & { declaredBy?: string | undefined };

/** Запись в том виде, что отдаёт индекс: нужны тип, статус, связи и фаза задачи. */
export interface StrategyRecord {
  id: string;
  type: string;
  status: string;
  phase?: string | null | undefined;
  links: Readonly<Partial<Record<string, readonly string[]>>>;
  extra?: Readonly<Record<string, unknown>> | undefined;
}

export interface StrategyInput {
  capabilities: readonly StrategyCapability[];
  records: readonly StrategyRecord[];
  /** Последний итог проверки: `passed`, `failed`, `skipped`, `blocked`. */
  results: Readonly<Record<string, { state: string } | undefined>>;
  issues: readonly { severity: string; recordId: string | null; message: string }[];
  /** Фазы с просрочкой вехи: номер фазы → дней. */
  overdue: ReadonlyMap<string, number>;
}

const OUT = new Set(['superseded', 'rejected', 'dropped', 'legacy', 'deferred']);
const MANUAL = new Set(['manual', 'review']);

/** Записи узла: задачи, меняющие карты, что объявили его или потомков, их требования и проверки этих требований. */
export function nodeRecords(id: string, input: StrategyInput): { tasks: StrategyRecord[]; requirements: StrategyRecord[]; checks: StrategyRecord[]; maps: Set<string> } {
  const index = childrenIndex(input.capabilities);
  const byId = new Map(input.capabilities.map((item) => [item.id, item]));
  const maps = new Set<string>();
  const seen = new Set<string>();
  const walk = (current: string) => {
    if (seen.has(current)) return;
    seen.add(current);
    const item = byId.get(current);
    if (item?.declaredBy) maps.add(item.declaredBy);
    for (const kid of index.get(current) ?? []) walk(kid.id);
  };
  walk(id);
  const live = input.records.filter((record) => !OUT.has(record.status));
  const tasks = live.filter((record) => record.type === 'task' && (record.links['affects'] ?? []).some((map) => maps.has(map)));
  const reqIds = new Set(tasks.flatMap((task) => task.links['implements'] ?? []));
  const requirements = live.filter((record) => record.type === 'requirement' && reqIds.has(record.id));
  const checkIds = new Set<string>();
  for (const requirement of requirements) for (const check of requirement.links['verified_by'] ?? []) checkIds.add(check);
  for (const record of live) if (record.type === 'verification' && (record.links['verifies'] ?? []).some((req) => reqIds.has(req))) checkIds.add(record.id);
  for (const task of tasks) for (const check of task.links['verified_by'] ?? []) checkIds.add(check);
  const checks = live.filter((record) => record.type === 'verification' && checkIds.has(record.id));
  return { tasks, requirements, checks, maps };
}

/** Здоровье одного узла по четырём сигналам; состояние — худшее из них. */
export function nodeHealth(id: string, input: StrategyInput): NodeHealth {
  const reasons: HealthReason[] = [];
  const index = childrenIndex(input.capabilities);
  const byId = new Map(input.capabilities.map((item) => [item.id, item]));

  // Прогресс: обещано «сейчас» (горизонт now), а лист не реализован — внимание.
  for (const leaf of leavesUnder(id, index, byId)) {
    if (leaf.horizon === 'now' && leaf.status === 'not_implemented') {
      reasons.push({ signal: 'progress', level: 'attention', text: `«${leaf.title ?? leaf.id}» обещано сейчас и не реализовано` });
    }
  }

  const { tasks, requirements, checks, maps } = nodeRecords(id, input);

  // Сроки: задача узла стоит в фазе с просроченной вехой.
  const covered = new Map<string, string>();
  for (const record of input.records) if (record.type === 'phase') for (const task of record.links['covers'] ?? []) covered.set(task, record.id);
  const late = new Set<string>();
  for (const task of tasks) {
    if (task.status === 'done') continue;
    const phase = task.phase ?? covered.get(task.id);
    if (phase && (input.overdue.get(phase) ?? 0) > 0) late.add(phase);
  }
  for (const phase of late) reasons.push({ signal: 'deadlines', level: 'problem', text: `фаза ${phase} просрочена на ${input.overdue.get(phase)} дн.`, recordId: phase });

  // Качество: провал — проблема; блокировка, ручная без приёмки, требование без проверок — внимание.
  for (const check of checks) {
    const state = input.results[check.id]?.state;
    if (state === 'failed') reasons.push({ signal: 'quality', level: 'problem', text: `проверка ${check.id} провалена`, recordId: check.id });
    else if (state === 'blocked') reasons.push({ signal: 'quality', level: 'attention', text: `проверка ${check.id} заблокирована`, recordId: check.id });
    else if (state !== 'passed' && MANUAL.has(String(check.extra?.['kind'] ?? ''))) reasons.push({ signal: 'quality', level: 'attention', text: `проверка ${check.id} ждёт ручной приёмки`, recordId: check.id });
  }
  for (const requirement of requirements) {
    const has = checks.some((check) => (check.links['verifies'] ?? []).includes(requirement.id)) || (requirement.links['verified_by'] ?? []).length > 0;
    if (!has) reasons.push({ signal: 'quality', level: 'attention', text: `у требования ${requirement.id} нет проверок`, recordId: requirement.id });
  }

  // Нарушения: ошибки — проблема, предупреждения — внимание; по записям узла и картам, что его объявили.
  const own = new Set<string>([...tasks, ...requirements, ...checks].map((record) => record.id).concat([...maps]));
  const errors = input.issues.filter((issue) => issue.recordId && own.has(issue.recordId) && issue.severity === 'error');
  const warnings = input.issues.filter((issue) => issue.recordId && own.has(issue.recordId) && issue.severity === 'warning');
  if (errors.length) reasons.push({ signal: 'violations', level: 'problem', text: `ошибок процесса: ${errors.length}`, recordId: errors[0]!.recordId! });
  if (warnings.length) reasons.push({ signal: 'violations', level: 'attention', text: `предупреждений: ${warnings.length}`, recordId: warnings[0]!.recordId! });

  const level = reasons.reduce<HealthLevel>((acc, reason) => worst(acc, reason.level), 'ok');
  return { level, reasons };
}

export interface Contour {
  id: string;
  title: string;
  summary?: string | undefined;
  owner: string | null;
  progress: Progress;
  /** Доля реализованных листьев, 0–100. */
  percent: number;
  health: NodeHealth;
}

/**
 * Контуры — возможности первого уровня функциональной карты. Здоровье узла
 * уже свёрнуто снизу вверх: записи потомков входят в записи контура.
 */
export function strategyContours(input: StrategyInput): Contour[] {
  const index = childrenIndex(input.capabilities);
  const byId = new Map(input.capabilities.map((item) => [item.id, item]));
  return (index.get(null) ?? []).map((item) => {
    const progress = progressOf(leavesUnder(item.id, index, byId));
    const percent = progress.total ? Math.round((progress.implemented / progress.total) * 100) : 0;
    return {
      id: item.id,
      title: item.title ?? item.id,
      summary: item.summary,
      owner: effectiveOwner(item, byId)?.value ?? null,
      progress,
      percent,
      health: nodeHealth(item.id, input)
    };
  });
}
