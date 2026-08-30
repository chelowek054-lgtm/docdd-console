import { findDependencyCycles, incomingEdges, outgoing, type Graph } from './graph';
import { firstHeading } from './parse';
import {
  DEFAULT_POLICY,
  RECORD_TYPES,
  violation,
  type LinkKind,
  type Policy,
  type RecordType,
  type SectionKey,
  type VerificationResult,
  type Violation,
  type WorkRecord
} from './types';

export interface RuleContext {
  records: readonly WorkRecord[];
  graph: Graph;
  policy: Policy;
  /** Результаты последних прогонов; отсутствие ключа — прогонов не было. */
  verifications: ReadonlyMap<string, VerificationResult>;
  /** «Сегодня» приходит снаружи, иначе тест на `task_stale` зависит от календаря. */
  now: Date;
  code: {
    /** Каталоги из `sources.code` манифеста, относительно корня проекта. */
    roots: readonly string[];
    /** Существующие файлы кода: обход каталога — не дело чистой функции. */
    files: ReadonlySet<string>;
  };
}

const PREFIX_BY_TYPE: Readonly<Record<RecordType, string>> = {
  requirement: 'R',
  design: 'D',
  decision: 'A',
  contract: 'C',
  task: 'T',
  phase: 'P',
  verification: 'V'
};

const SECTION_BY_TYPE: Readonly<Record<RecordType, SectionKey>> = {
  requirement: 'requirements',
  design: 'design',
  decision: 'decisions',
  contract: 'contracts',
  task: 'tasks',
  phase: 'phases',
  verification: 'tests'
};

/** Таблица связей из docs/02-workspace-contract.md, строка в строку. */
const LINK_RULES: Readonly<Record<LinkKind, { from: readonly RecordType[]; to: readonly RecordType[] | 'same' }>> = {
  implements: { from: ['task'], to: ['requirement'] },
  refines: { from: ['design', 'task'], to: ['design', 'requirement'] },
  decided_by: { from: ['design', 'task'], to: ['decision'] },
  supersedes: { from: RECORD_TYPES, to: 'same' },
  depends_on: { from: ['task'], to: ['task'] },
  verified_by: { from: ['requirement', 'task'], to: ['verification'] },
  verifies: { from: ['verification'], to: ['requirement', 'task'] },
  documents: { from: ['task'], to: ['design', 'contract'] },
  covers: { from: ['phase'], to: ['task'] }
};

const LINK_TITLES: Readonly<Record<LinkKind, string>> = {
  implements: 'выполняет требование',
  refines: 'уточняет',
  decided_by: 'опирается на решение',
  supersedes: 'заменяет',
  depends_on: 'зависит от',
  verified_by: 'проверяется',
  verifies: 'проверяет',
  documents: 'правит документ',
  covers: 'входит в состав'
};

const DOC_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ['review', 'dropped'],
  review: ['draft', 'approved', 'dropped'],
  approved: ['superseded'],
  superseded: [],
  dropped: []
};

const DECISION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ['review', 'rejected'],
  review: ['draft', 'approved', 'rejected'],
  approved: ['superseded'],
  superseded: [],
  rejected: []
};

const TASK_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  backlog: ['ready', 'dropped'],
  ready: ['in_progress', 'dropped'],
  in_progress: ['in_review', 'dropped'],
  in_review: ['in_progress', 'done'],
  done: [],
  dropped: []
};

/** «Ready и дальше»: с этого момента задача обязана выполнять требование. */
const TASK_READY_AND_BEYOND = ['ready', 'in_progress', 'in_review', 'done'];

/**
 * Проверки самой записи: тип, идентификатор, заголовок. Вынесены отдельно от
 * `checkAll`, потому что их результат нужен раньше схемы — по нему подавляются
 * дублирующие ошибки схемы на полях `type` и `id` (docs/05-validation.md).
 */
export function checkRecordIdentity(record: WorkRecord): Violation[] {
  const found: Violation[] = [];
  const path = record.source.path;
  const type = record.type;
  const knownType = isRecordType(type);

  if (type && !knownType) {
    found.push(violation(
      'unknown_type',
      record.id || null,
      path,
      'Тип `' + type + '` не из списка контракта. Запись показывается как есть, но в правилах процесса не участвует.'
    ));
  }

  if (isRecordType(type) && /^[RDACTPV]-\d{4}$/.test(record.id)) {
    const expectedPrefix = PREFIX_BY_TYPE[type];
    if (!record.id.startsWith(expectedPrefix + '-')) {
      found.push(violation(
        'id_mismatch',
        record.id,
        path,
        'Идентификатор `' + record.id + '` не соответствует типу `' + type + '`: ожидается префикс `' + expectedPrefix + '-`. Номера не переиспользуются, поэтому меняйте тип, а не номер.'
      ));
    } else if (record.source.section && record.source.section !== SECTION_BY_TYPE[type]) {
      found.push(violation(
        'id_mismatch',
        record.id,
        path,
        'Запись типа `' + type + '` лежит в разделе `' + record.source.section + '`, а её место — `' + SECTION_BY_TYPE[type] + '`. Перенесите файл или исправьте тип.'
      ));
    }
  }

  const heading = firstHeading(record.body);
  if (heading !== null && record.title && heading !== record.title) {
    found.push(violation(
      'title_mismatch',
      record.id || null,
      path,
      'Заголовок «' + heading + '» не совпадает с полем `title` «' + record.title + '». В списках виден `title`, в файле — заголовок; расхождение разводит их в разные стороны.'
    ));
  }

  return found;
}

/** Все остальные коды: дубли, связи, ссылки на код и правила процесса. */
export function checkAll(ctx: RuleContext): Violation[] {
  return [
    ...checkDuplicates(ctx),
    ...checkLinks(ctx),
    ...checkCycles(ctx),
    ...checkSuperseded(ctx),
    ...checkCodeLinks(ctx),
    ...taskNotReadyDocs(ctx),
    ...taskNoRequirement(ctx),
    ...taskDoneUnverified(ctx),
    ...requirementUnverified(ctx),
    ...requirementUnimplemented(ctx),
    ...docChangedAfterTask(ctx),
    ...taskStale(ctx),
    ...verificationNeverRun(ctx)
  ];
}

export function checkDuplicates(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const id of ctx.graph.duplicates) {
    const paths = ctx.records.filter((record) => record.id === id).map((record) => record.source.path);
    for (const path of paths) {
      found.push(violation(
        'id_duplicate',
        id,
        path,
        'Идентификатор `' + id + '` занят несколькими файлами: ' + paths.join(', ') + '. Ссылка на него ведёт неизвестно куда — оставьте один файл, второму дайте свободный номер.'
      ));
    }
  }
  return found;
}

export function checkLinks(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    if (!record.id) continue;
    for (const edge of outgoing(ctx.graph, record.id)) {
      const target = ctx.graph.byId.get(edge.to);
      if (!target) {
        found.push(violation(
          'link_broken',
          record.id,
          record.source.path,
          'Связь `' + edge.kind + '` ведёт на `' + edge.to + '`, а такой записи нет. Либо запись удалили, либо в номере опечатка: номера не переиспользуются, так что вернуть прежнюю нельзя.'
        ));
        continue;
      }
      // Тип источника или цели неизвестен — судить о допустимости связи не по чему.
      if (!isRecordType(record.type) || !isRecordType(target.type)) continue;

      const rule = LINK_RULES[edge.kind];
      if (!rule.from.includes(record.type)) {
        found.push(violation(
          'link_wrong_type',
          record.id,
          record.source.path,
          'Связь `' + edge.kind + '` (' + LINK_TITLES[edge.kind] + ') не ставится от записи типа `' + record.type + '`: её ставят ' + rule.from.map((t) => '`' + t + '`').join(' или ') + '.'
        ));
        continue;
      }
      if (rule.to === 'same') {
        if (target.type !== record.type) {
          found.push(violation(
            'link_wrong_type',
            record.id,
            record.source.path,
            'Связь `supersedes` ведёт на `' + edge.to + '` типа `' + target.type + '`: заменить запись может только запись того же типа.'
          ));
        }
        continue;
      }
      if (!rule.to.includes(target.type)) {
        found.push(violation(
          'link_wrong_type',
          record.id,
          record.source.path,
          'Связь `' + edge.kind + '` ведёт на `' + edge.to + '` типа `' + target.type + '`, а должна вести на ' + rule.to.map((t) => '`' + t + '`').join(' или ') + '.'
        ));
      }
    }
  }
  return found;
}

export function checkCycles(ctx: RuleContext): Violation[] {
  return findDependencyCycles(ctx.graph).map((cycle) => {
    const first = cycle[0] as string;
    const record = ctx.graph.byId.get(first);
    return violation(
      'link_cycle',
      first,
      record?.source.path ?? '',
      'Цикл в `depends_on`: ' + [...cycle, first].join(' → ') + '. Ни одна из этих задач не может начаться первой — снимите одну связь.'
    );
  });
}

export function checkSuperseded(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    if (record.status !== 'superseded' || !record.id) continue;
    if (incomingEdges(ctx.graph, record.id, 'supersedes').length > 0) continue;
    found.push(violation(
      'superseded_without_successor',
      record.id,
      record.source.path,
      'Запись ' + record.id + ' помечена `superseded`, но ни одна запись не ссылается на неё через `supersedes`. Непонятно, что читать вместо неё: добавьте связь в записи-преемнике.'
    ));
  }
  return found;
}

export function checkCodeLinks(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    for (const link of codeLinkCandidates(record.body)) {
      const target = resolvePath(dirname(record.source.path), link);
      if (target === null) continue;
      if (!ctx.code.roots.some((root) => isInside(root, target))) continue;
      if (ctx.code.files.has(target)) continue;
      found.push(violation(
        'code_link_missing',
        record.id || null,
        record.source.path,
        'Ссылка на файл кода `' + target + '` ведёт в пустоту: код переехал или переименован. Поправьте путь, пока документ и код не разошлись окончательно.'
      ));
    }
  }
  return found;
}

export function taskNotReadyDocs(ctx: RuleContext): Violation[] {
  if (!(ctx.policy.require_approved_docs_before_dev ?? DEFAULT_POLICY.require_approved_docs_before_dev)) {
    return [];
  }
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'ready' && task.status !== 'in_progress') continue;
    for (const kind of ['documents', 'refines'] as const) {
      for (const id of task.links[kind] ?? []) {
        const target = ctx.graph.byId.get(id);
        // Ссылки в никуда — забота link_broken; здесь про подтверждение.
        if (!target || target.status === 'approved') continue;
        found.push(violation(
          'task_not_ready_docs',
          task.id,
          task.source.path,
          'Задача ' + task.id + ' не может быть в статусе `' + task.status + '`: ' + id + ' в статусе `' + target.status + '`. Подтвердите документ или снимите связь `' + kind + '`.'
        ));
      }
    }
  }
  return found;
}

export function taskNoRequirement(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (!TASK_READY_AND_BEYOND.includes(task.status)) continue;
    if ((task.links.implements ?? []).length > 0) continue;
    found.push(violation(
      'task_no_requirement',
      task.id,
      task.source.path,
      'Задача ' + task.id + ' в статусе `' + task.status + '` не выполняет ни одного требования: связь `implements` пуста. Работа без требования не проверяется фактом — добавьте `implements` или верните задачу в `backlog`.'
    ));
  }
  return found;
}

export function taskDoneUnverified(ctx: RuleContext): Violation[] {
  if (!(ctx.policy.require_verification_before_done ?? DEFAULT_POLICY.require_verification_before_done)) {
    return [];
  }
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'done') continue;
    for (const id of task.links.verified_by ?? []) {
      if (!ctx.graph.byId.has(id)) continue;
      const result = ctx.verifications.get(id);
      if (result === 'passed') continue;
      const state = result ? 'в состоянии `' + result + '`' : 'ни разу не запускалась';
      found.push(violation(
        'task_done_unverified',
        task.id,
        task.source.path,
        'Задача ' + task.id + ' закрыта, а проверка ' + id + ' ' + state + '. Закрытая задача без пройденной проверки — обещание, а не факт.'
      ));
    }
  }
  return found;
}

export function requirementUnverified(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    if (record.type !== 'requirement' || record.status !== 'approved' || !record.id) continue;
    const declared = (record.links.verified_by ?? []).length;
    // Связь можно объявить с любой стороны: обратную строит приложение.
    const backwards = incomingEdges(ctx.graph, record.id, 'verifies').length;
    if (declared + backwards > 0) continue;
    found.push(violation(
      'requirement_unverified',
      record.id,
      record.source.path,
      'Требование ' + record.id + ' подтверждено, но ничем не проверяется: нет ни `verified_by`, ни проверки со ссылкой `verifies` на него. По чему судить, что оно выполнено?'
    ));
  }
  return found;
}

export function requirementUnimplemented(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    if (record.type !== 'requirement' || record.status !== 'approved' || !record.id) continue;
    if (incomingEdges(ctx.graph, record.id, 'implements').length > 0) continue;
    found.push(violation(
      'requirement_unimplemented',
      record.id,
      record.source.path,
      'На требование ' + record.id + ' не ссылается ни одна задача. Либо работа не заведена, либо требование подтвердили раньше времени.'
    ));
  }
  return found;
}

export function docChangedAfterTask(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'done') continue;
    const closed = dateOf(task, 'updated');
    if (!closed) continue;
    for (const id of task.links.documents ?? []) {
      const doc = ctx.graph.byId.get(id);
      const changed = doc ? dateOf(doc, 'updated') : null;
      if (!doc || !changed || changed <= closed) continue;
      found.push(violation(
        'doc_changed_after_task',
        task.id,
        task.source.path,
        'Документ ' + id + ' изменён ' + changed + ', а задача ' + task.id + ', которая его правила, закрыта ' + closed + '. Либо изменение осталось без работы, либо задачу закрыли рано.'
      ));
    }
  }
  return found;
}

export function taskStale(ctx: RuleContext): Violation[] {
  const limit = ctx.policy.stale_in_progress_days;
  // Порога нет — проект не считает задержку нарушением, и придумывать его не нам.
  if (limit === undefined) return [];

  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'in_progress') continue;
    const since = dateOf(task, 'updated');
    if (!since) continue;
    const days = daysBetween(since, ctx.now);
    if (days === null || days <= limit) continue;
    found.push(violation(
      'task_stale',
      task.id,
      task.source.path,
      'Задача ' + task.id + ' в работе с ' + since + ' — это ' + days + ' дней при пороге ' + limit + '. Либо работа идёт и `updated` устарел, либо задача брошена.'
    ));
  }
  return found;
}

export function verificationNeverRun(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    if (record.type !== 'verification' || !record.id) continue;
    if (ctx.verifications.has(record.id)) continue;
    found.push(violation(
      'verification_never_run',
      record.id,
      record.source.path,
      'Проверка ' + record.id + ' объявлена, но её нет ни в одном отчёте прогона. Пока она не запущена, она ничего не подтверждает.'
    ));
  }
  return found;
}

/**
 * Ответ на «можно ли выполнить переход». Отличается от остальных правил тем,
 * что отвечает на запрос действия, а не описывает состояние набора записей.
 * Возвращает всё, что мешает: отказ обязан перечислять блокирующее целиком.
 */
export function checkTransition(record: WorkRecord, to: string, ctx: RuleContext): Violation[] {
  const path = record.source.path;
  const table = transitionsFor(record.type);

  if (!table) {
    return [violation(
      'transition_forbidden',
      record.id || null,
      path,
      record.type === 'phase'
        ? 'Статус фазы ' + record.id + ' считается по задачам из `covers` и вручную не ставится.'
        : 'У записи типа `' + record.type + '` нет схемы статусов, поэтому переход в `' + to + '` невозможен.'
    )];
  }

  const allowed = table[record.status];
  if (!allowed || !allowed.includes(to)) {
    const options = allowed && allowed.length > 0
      ? 'Из `' + record.status + '` возможны только ' + allowed.map((s) => '`' + s + '`').join(', ') + '.'
      : 'Из `' + record.status + '` переходов нет.';
    return [violation(
      'transition_forbidden',
      record.id || null,
      path,
      'Переход ' + record.id + ' из `' + record.status + '` в `' + to + '` не описан в схеме статусов. ' + options
    )];
  }

  // Переход по схеме возможен — остаётся спросить условия из таблицы переходов
  // контракта. Они называются своими кодами: причина отказа должна совпадать с
  // тем, что человек уже видел в списке нарушений.
  const probe: WorkRecord = { ...record, status: to };
  const scoped: RuleContext = { ...ctx, records: [probe] };
  if (to === 'ready') {
    return [...taskNotReadyDocs(scoped), ...taskNoRequirement(scoped)];
  }
  if (to === 'done') {
    return taskDoneUnverified(scoped);
  }
  return [];
}

function transitionsFor(type: string): Readonly<Record<string, readonly string[]>> | null {
  switch (type) {
    case 'requirement':
    case 'design':
    case 'contract':
    case 'verification':
      return DOC_TRANSITIONS;
    case 'decision':
      return DECISION_TRANSITIONS;
    case 'task':
      return TASK_TRANSITIONS;
    default:
      return null;
  }
}

function tasks(ctx: RuleContext): WorkRecord[] {
  return ctx.records.filter((record) => record.type === 'task' && record.id !== '');
}

function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}

function dateOf(record: WorkRecord, field: 'created' | 'updated'): string | null {
  const value = record.data[field];
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function daysBetween(isoDate: string, now: Date): number | null {
  const from = Date.parse(isoDate + 'T00:00:00Z');
  if (Number.isNaN(from)) return null;
  const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((to - from) / 86_400_000);
}

/**
 * Ссылки на код ищутся в теле обычной markdown-ссылкой
 * (docs/02-workspace-contract.md, раздел «Ссылки на код»). Внешние адреса и
 * якоря внутри документа кодом не являются.
 */
export function codeLinkCandidates(body: string): string[] {
  const links: string[] = [];
  const pattern = /!?\[[^\]]*\]\(\s*<?([^)>\s]+)>?\s*(?:"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const raw = match[1];
    if (!raw || raw.startsWith('#')) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) continue;
    // Строки съезжают, файл остаётся: якорь вида #L12-L40 отбрасываем.
    links.push(raw.split('#')[0] as string);
  }
  return links.filter((link) => link !== '');
}

function dirname(path: string): string {
  const at = path.lastIndexOf('/');
  return at === -1 ? '' : path.slice(0, at);
}

/** Разбор пути строкой: в чистой функции нет ни файловой системы, ни разделителя ОС. */
export function resolvePath(baseDir: string, relative: string): string | null {
  const segments = relative.startsWith('/') ? [] : baseDir.split('/').filter(Boolean);
  for (const part of relative.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      // Выход выше корня проекта — не наше дело, такой путь мы не проверяем.
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.join('/');
}

function isInside(root: string, path: string): boolean {
  const normalized = root.replace(/\/+$/, '');
  return normalized === '' || path === normalized || path.startsWith(normalized + '/');
}
