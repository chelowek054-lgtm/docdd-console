import { findDependencyCycles, incomingEdges, outgoing, type Graph } from './graph';
import { checkArchitecture } from './architecture';
import { buildReferenceIndex, sameIndex, type ReferenceEntry } from './reference';
import type { RulesResolution } from './practice-rules';
import { capabilityFindings } from './coverage';
import { brokenMapLinks, inputsNotReady, effectiveHorizon, effectiveOwner, effectivePriority } from './functional';
import { approvedMaps, checkEvidence, evidenceClaims, foldMaps, parseMapRecord, type MapChange } from './maps';
import { firstHeading } from './parse';
import {
  DEFAULT_POLICY,
  DEVELOPMENT_DIR,
  PREFIX_BY_TYPE,
  RECORD_TYPES,
  RETIRED_STATUSES,
  SECTION_BY_TYPE,
  violation,
  type ArchitectureConfig,
  type LinkKind,
  type ProjectManifest,
  type Policy,
  type RecordType,
  type VerificationResult,
  type Violation,
  type WorkRecord
} from './types';
import { plainTokens, type DesignResolution } from './design';
import { PASS_LABEL, latestReports, type DesignReport } from './design-screens'; import { buildCatalogReport, catalogSources } from './design-catalog';
import {
  STACK_LABEL,
  compareFile,
  componentsMissing,
  exportStack,
  isSafeRelative,
  projectFilePath,
  providedComponents
} from './design-export';

export interface RuleContext {
  records: readonly WorkRecord[];
  graph: Graph;
  policy: Policy;
  /** Правила архитектуры из манифеста; нет секции — нет проверки (docs/07-maps.md). */
  architecture?: ArchitectureConfig;
  /** Откуда взялись правила: источники, перекрытия, конфликты (docs/12-practice-rules.md). */
  rules?: RulesResolution;
  /** Токены дизайна после сложения «общее → локальное» (docs/16-design-system.md). */
  design?: DesignResolution;
  /** Стеки и файлы темы проекта из манифеста: по ним сверяется выгрузка (docs/16-design-system.md). */
  designStacks?: NonNullable<ProjectManifest['design']>['stacks']; /** Выгрузка Storybook проекта (`design.catalog`). */ designCatalog?: string;
  /** Принятые отчёты проверки экранов моделью. */
  designReports?: readonly DesignReport[];
  /** Справочник включён (`paths.reference`): путь к индексу и порог устаревания (docs/13-reference.md). */
  reference?: { path: string; staleDays: number };
  /** Справки из подключённых источников — в индекс идут с меткой. */
  sharedReferences?: readonly ReferenceEntry[];
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
  /** Существующие файлы внутри `docs/development`: тем же способом и по той же причине. */
  documents: ReadonlySet<string>;
  /**
   * Состояние работы над задачами: какие отданы модели и не разобраны, какие
   * ветки остались. Считает вызывающая сторона — git в чистых правилах не место.
   */
  work?: {
    unreviewed: ReadonlySet<string>;
    orphanBranches: ReadonlySet<string>;
  };
  /**
   * Содержимое файла проекта для сверки свидетельств карт. `null` — файла нет.
   * Файловая система остаётся снаружи: правила по-прежнему чистые функции.
   */
  readSource?: (path: string) => string | null;
}

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
  covers: { from: ['phase'], to: ['task'] },
  affects: { from: ['task'], to: ['map'] },
  reuses: { from: ['task', 'design'], to: ['reference'] },
  found_by: { from: ['defect'], to: ['verification'] },
  fixed_by: { from: ['defect'], to: ['task'] },
  breaks: { from: ['defect'], to: ['requirement'] }, ships: { from: ['release'], to: ['task'] }
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
  covers: 'входит в состав',
  affects: 'меняет карту',
  reuses: 'переиспользует справку',
  found_by: 'найден проверкой',
  fixed_by: 'чинится задачей',
  breaks: 'нарушает требование', ships: 'выкладывает задачу'
};

// Из любого статуса, кроме начального `draft`, есть путь назад
// (docs/adr/0012-status-reopening.md) — обычное подтверждаемое действие,
// а не отдельная операция «отмена». Значение записи это не меняет:
// вернувшись в `draft`, запись снова проходит весь путь подтверждения.
const DOC_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ['review', 'dropped'],
  review: ['draft', 'approved', 'dropped'],
  approved: ['superseded', 'draft'],
  superseded: ['draft'],
  dropped: ['draft']
};

const DECISION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ['review', 'rejected'],
  review: ['draft', 'approved', 'rejected'],
  approved: ['superseded', 'draft'],
  superseded: ['draft'],
  rejected: ['draft']
};

const TASK_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  backlog: ['ready', 'dropped'],
  ready: ['in_progress', 'dropped', 'backlog'],
  in_progress: ['in_review', 'dropped', 'ready'],
  in_review: ['in_progress', 'done'],
  done: ['in_review'],
  dropped: ['backlog']
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

  if (isRecordType(type) && /^[RDACTPVMSBL]-\d{4}$/.test(record.id)) {
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
    ...checkDocLinks(ctx),
    ...checkMaps(ctx),
    ...taskMapsUnapproved(ctx),
    ...changeMissing(ctx),
    ...mapCapabilityMissing(ctx),
    ...capabilityConsistency(ctx),
    ...architectureRules(ctx),
    ...rulesConflict(ctx),
    ...designRules(ctx),
    ...designDrift(ctx), ...designCatalogRules(ctx),
    ...designScreenFindings(ctx),
    ...referenceRules(ctx),
    ...taskReuseUnchecked(ctx),
    ...workUnreviewed(ctx),
    ...workBranchOrphan(ctx),
    ...taskNotReadyDocs(ctx),
    ...taskNoRequirement(ctx),
    ...taskDoneUnverified(ctx),
    ...codeSourcesEmptyAfterFeature(ctx),
    ...requirementUnverified(ctx),
    ...requirementUnimplemented(ctx),
    ...docChangedAfterTask(ctx),
    ...taskStale(ctx),
    ...verificationNeverRun(ctx),
    ...taskNoVerification(ctx),
    ...capabilityNoOwner(ctx),
    ...mapLinksBroken(ctx), ...blockInputsNotReady(ctx)
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
    for (const link of markdownLinkTargets(record.body)) {
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

/**
 * Ссылка одного документа на другой (docs/02-workspace-contract.md, раздел
 * «Ссылки на документы»). Предупреждение, а не ошибка: связи задаются
 * идентификаторами, а ссылка в тексте — удобство для читателя.
 */
export function checkDocLinks(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const record of ctx.records) {
    for (const link of markdownLinkTargets(record.body)) {
      if (!link.toLowerCase().endsWith('.md')) continue;
      const target = resolvePath(dirname(record.source.path), link);
      if (target === null || !isInside(DEVELOPMENT_DIR, target)) continue;
      if (ctx.documents.has(target)) continue;
      found.push(violation(
        'doc_link_missing',
        record.id || null,
        record.source.path,
        'Ссылка на документ `' + target + '` ведёт в пустоту: файл переименован или удалён. Поправьте путь — читатель пойдёт по ней раньше, чем по связям.'
      ));
    }
  }
  return found;
}

/**
 * Разбор карт и сверка свидетельств (docs/07-maps.md). Пока карта описывает
 * намерение — сверять нечего: код ещё не написан. Сверка начинается, когда
 * задачи, которые карту меняют, закрыты.
 */
export function checkMaps(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];

  for (const record of ctx.records) {
    if (record.type !== 'map' || !record.id) continue;

    const parsed = parseMapRecord(record.body);
    // Отставленная карта (заменена, отменена, отвергнута) больше не читается
    // как текущая — её форма никого не вводит в заблуждение и чинить в ней
    // уже нечего (docs/05-validation.md).
    if (!RETIRED_STATUSES.has(record.status)) {
      for (const problem of parsed.problems) {
        found.push(violation(
          'map_invalid',
          record.id,
          record.source.path,
          problem.message + ' Карта, которую нельзя разобрать, ничего не описывает.'
        ));
      }
    }

    if (record.status !== 'approved' || !ctx.readSource) continue;
    // `intent: true` — карта нового кода, которого ещё нет: сверка не про то,
    // закрыта ли задача, а про то, что задачи для этого куска может не быть
    // вовсе (docs/07-maps.md, «Карта нового проекта»).
    if (record.data['intent'] === true) continue;
    // Незакрытая задача означает, что кода ещё нет: это план, а не расхождение.
    if (!settled(ctx, record.id)) continue;

    found.push(...verifyEvidence(ctx, record.id, record.source.path, parsed.change));
  }

  return found;
}

function verifyEvidence(ctx: RuleContext, id: string, path: string, change: MapChange): Violation[] {
  const found: Violation[] = [];
  const read = ctx.readSource;
  if (!read) return found;

  for (const claim of evidenceClaims(change)) {
    const verdict = checkEvidence(claim.evidence, read(claim.evidence.path), claim.side);
    const where = `\`${claim.evidence.path}\`:${claim.evidence.line}`;

    if (verdict === 'missing') {
      found.push(violation(
        'map_evidence_missing',
        id,
        path,
        `Карта утверждает «${claim.label}», а файла ${where} нет. Утверждение без свидетельства — мнение, а не карта.`
      ));
      continue;
    }
    if (verdict === 'stale') {
      found.push(violation(
        'map_evidence_stale',
        id,
        path,
        `Карта утверждает «${claim.label}» со ссылкой на ${where}, но такой строки там нет: код уехал из-под карты.`
      ));
      continue;
    }
    if (verdict === 'still_present') {
      found.push(violation(
        'map_drift',
        id,
        path,
        `Карта объявила «${claim.label}» убранным, а в ${where} это на месте. Задача закрыта, значит код и карта разошлись.`
      ));
    }
  }

  return found;
}

/** Все задачи, меняющие карту, закрыты или отменены — значит код уже написан. */
function settled(ctx: RuleContext, mapId: string): boolean {
  const tasks = incomingEdges(ctx.graph, mapId, 'affects')
    .map((edge) => ctx.graph.byId.get(edge.from))
    .filter((task): task is WorkRecord => task !== undefined);
  return tasks.every((task) => task.status === 'done' || task.status === 'dropped');
}

/**
 * Задача с `change: feature` не уходит в работу без подтверждённой карты:
 * карты ведут код так же, как документы (docs/07-maps.md).
 */
export function taskMapsUnapproved(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (!TASK_READY_AND_BEYOND.includes(task.status)) continue;
    if (task.data['change'] !== 'feature') continue;

    const ids = task.links.affects ?? [];
    if (ids.length === 0) {
      found.push(violation(
        'task_maps_unapproved',
        task.id,
        task.source.path,
        `Задача ${task.id} объявлена как \`feature\`, но не меняет ни одной карты. Либо свяжите её с картой изменения, либо назовите изменение честнее: \`fix\`, \`rename\` или \`format\`.`
      ));
      continue;
    }

    for (const id of ids) {
      const map = ctx.graph.byId.get(id);
      if (!map) continue; // о ссылке в никуда уже сказал link_broken
      if (map.status === 'approved') continue;
      found.push(violation(
        'task_maps_unapproved',
        task.id,
        task.source.path,
        `Задача ${task.id} в статусе \`${task.status}\`, а карта ${id} — \`${map.status}\`. Устройство меняется до кода, а не после: подтвердите карту.`
      ));
    }
  }
  return found;
}

/**
 * Функция сделана, а в функциональной карте её нет: источник правды отстал
 * (docs/08-usage.md, «Правила реализации»). Срабатывает с `in_review`, а не с
 * `ready`: карта-намерение на пачку задач пуста по замыслу, и раньше шума было
 * бы больше, чем толку.
 */
export function mapCapabilityMissing(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'in_review' && task.status !== 'done') continue;
    if (task.data['change'] !== 'feature') continue;

    const declares = (task.links.affects ?? []).some((id) => {
      const map = ctx.graph.byId.get(id);
      if (!map || map.type !== 'map') return false;
      const parsed = parseMapRecord(map.body).change.functional;
      return (parsed?.added?.capabilities?.length ?? 0) > 0;
    });
    if (declares) continue;

    found.push(violation(
      'map_capability_missing',
      task.id,
      task.source.path,
      `Задача ${task.id} (\`feature\`) дошла до \`${task.status}\`, а ни одна её карта не объявляет возможность функциональной карты. Функциональная карта — источник правды: добавьте возможность (или уточните существующую) новой картой и свяжите её с задачей.`
    ));
  }
  return found;
}

/**
 * Отметка состояния возможности и то, что за ней стоит в процессе (docs/05-validation.md,
 * «Карты»). Висит на карте, где возможность объявлена последней: именно там стоит
 * отметка, которую надо поправить или подтвердить.
 */
export function capabilityConsistency(ctx: RuleContext): Violation[] {
  const pathOf = new Map(ctx.records.map((record) => [record.id, record.source.path]));
  return capabilityFindings(ctx.records, ctx.verifications).map((finding) =>
    violation(finding.code, finding.map, pathOf.get(finding.map) ?? '', finding.message));
}

/**
 * Архитектура по подтверждённой карте кода (docs/05-validation.md, «Архитектура»).
 * Нарушение висит на карте, объявившей импорт: именно её надо поправить или
 * подтвердить заново. Нет секции `architecture` — нет проверки.
 */
export function architectureRules(ctx: RuleContext): Violation[] {
  if (!ctx.architecture) return [];
  const codemap = foldMaps(approvedMaps(ctx.records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }))).codemap;
  if (codemap.imports.length === 0) return [];

  const pathOf = new Map(ctx.records.map((record) => [record.id, record.source.path]));
  const result = checkArchitecture({
    config: ctx.architecture,
    files: ctx.code.files,
    modules: codemap.modules,
    imports: codemap.imports
  });
  return result.findings.map((finding) => violation(
    finding.code,
    finding.declaredBy ?? null,
    (finding.declaredBy && pathOf.get(finding.declaredBy)) || '',
    finding.rule ? `${finding.message} Правило: ${finding.rule.source}${finding.rule.key ? ` (${finding.rule.key})` : ''}.` : finding.message
  ));
}

/** Справки проекта в виде, пригодном для индекса: подтверждённые, с названным видом и датой. */
export function referenceEntries(records: readonly WorkRecord[]): ReferenceEntry[] {
  return records
    .filter((record) => record.type === 'reference' && record.status === 'approved' && record.id)
    .map((record) => ({
      id: record.id,
      title: record.title,
      summary: typeof record.data['summary'] === 'string' ? record.data['summary'] : '',
      kind: typeof record.data['kind'] === 'string' ? record.data['kind'] : '',
      fetched: record.data['fetched'] ? String(record.data['fetched']).slice(0, 10) : '',
      path: record.source.path
    }));
}

/**
 * Справочник (docs/13-reference.md): справка без `summary`, справка, которая давно не
 * обновлялась, и индекс, расходящийся с тем, что собралось бы сейчас. Нет
 * `paths.reference` — справочника нет, и проверять нечего.
 */
export function referenceRules(ctx: RuleContext): Violation[] {
  if (!ctx.reference) return [];
  const found: Violation[] = [];
  const staleMs = ctx.reference.staleDays * 86_400_000;

  for (const record of ctx.records) {
    if (record.type !== 'reference' || !record.id || RETIRED_STATUSES.has(record.status)) continue;
    const summary = record.data['summary'];
    if (typeof summary !== 'string' || summary.trim() === '') {
      found.push(violation('reference_no_summary', record.id, record.source.path,
        `У справки ${record.id} нет \`summary\`: в индекс она попадёт безымянной, и по ней нельзя будет понять, что уже есть. Допишите одну строку — что она решает.`));
    }
    const fetched = Date.parse(String(record.data['fetched'] ?? '').slice(0, 10));
    if (!Number.isNaN(fetched) && ctx.now.getTime() - fetched > staleMs) {
      found.push(violation('reference_stale', record.id, record.source.path,
        `Справка ${record.id} получена ${String(record.data['fetched']).slice(0, 10)}, больше ${ctx.reference.staleDays} дней назад: сверьте её с источником и обновите дату.`));
    }
  }

  const codemap = foldMaps(approvedMaps(ctx.records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }))).codemap;
  const references = [...referenceEntries(ctx.records), ...(ctx.sharedReferences ?? [])];
  if (references.length === 0 && codemap.modules.length === 0) return found;

  const expected = buildReferenceIndex({ references, modules: codemap.modules, imports: codemap.imports, groups: codemap.groups }).text;
  if (ctx.readSource && !sameIndex(ctx.readSource(ctx.reference.path), expected)) {
    found.push(violation('reference_index_stale', null, ctx.reference.path,
      `Индекс справочника ${ctx.reference.path} расходится с тем, что собралось бы сейчас из справок и карты кода. Нажмите «Обновить индекс» на экране «Справочник»: руками файл не правится.`));
  }
  return found;
}

/**
 * Задача `feature` дошла до `ready` и дальше, а справочник не просмотрен: ни `reuses`,
 * ни записи «подходящего нет» (`reuse: none`). Напоминание, не запрет
 * (docs/13-reference.md, «Где справочник работает в процессе»).
 */
export function taskReuseUnchecked(ctx: RuleContext): Violation[] {
  if (!ctx.reference) return [];
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (!TASK_READY_AND_BEYOND.includes(task.status) || task.data['change'] !== 'feature') continue;
    if ((task.links.reuses ?? []).length > 0 || task.data['reuse'] === 'none') continue;
    found.push(violation('task_reuse_unchecked', task.id, task.source.path,
      `Задача ${task.id} (\`feature\`) в статусе \`${task.status}\` не смотрела справочник: нет ни \`reuses\`, ни \`reuse: none\`. Загляните в \`reference/INDEX.md\`: если что-то подходит — привяжите справку; нет — запишите «подходящего нет».`));
  }
  return found;
}

/**
 * Спор правил одного уровня и блок, который не разобрался (docs/12-practice-rules.md):
 * правило не должно молча выбираться или молча пропадать.
 */
export function rulesConflict(ctx: RuleContext): Violation[] {
  const resolution = ctx.rules;
  if (!resolution) return [];
  const pathOf = new Map(ctx.records.map((record) => [record.id, record.source.path]));
  const idOf = (source: string) => source.replace(/^\[[^\]]*\]\s*/, '');
  const found: Violation[] = [];
  for (const conflict of resolution.conflicts) {
    const id = idOf(conflict.records[conflict.records.length - 1] ?? '');
    found.push(violation('rules_conflict', pathOf.has(id) ? id : null, pathOf.get(id) ?? '',
      `Записи ${conflict.records.join(' и ')} задают разное для \`${conflict.key}\`: действует поздняя. Сведите правило в одну запись или заменяйте старую через \`supersedes\`.`));
  }
  for (const problem of resolution.problems) {
    found.push(violation('rules_conflict', pathOf.has(problem.record) ? problem.record : null, pathOf.get(problem.record) ?? '', problem.message));
  }
  return found;
}

/**
 * Токены дизайна (docs/16-design-system.md): контраст, полнота тем и шкал,
 * противоречие блоков, блок, который не разобрался. Нарушение вешается на
 * запись, чей блок его вызвал; общая запись из чужого источника в проекте
 * не лежит — тогда оно без записи, но с её именем в тексте.
 */
export function designRules(ctx: RuleContext): Violation[] {
  const design = ctx.design;
  if (!design || design.empty) return [];
  const pathOf = new Map(ctx.records.map((record) => [record.id, record.source.path]));
  const idOf = (source: string) => source.replace(/^\[[^\]]*\]\s*/, '');
  return design.checks.map((check) => {
    const id = check.source ? idOf(check.source) : '';
    const local = pathOf.has(id) && !/^\[/.test(check.source ?? '');
    const where = check.source && !local ? ` (запись ${check.source})` : '';
    return violation(check.code, local ? id : null, local ? pathOf.get(id) ?? '' : '', `${check.message}${where}`);
  });
}

/**
 * Файлы темы проекта и компоненты реестра против токенов (docs/16-design-system.md):
 * выгрузка строится из сложенных токенов и сравнивается с тем, что лежит в
 * проекте. Файл приложение не пишет — только называет расхождение.
 */
export function designDrift(ctx: RuleContext): Violation[] {
  const design = ctx.design;
  if (!design || design.empty) return [];
  const found: Violation[] = [];
  const tokens = plainTokens(design.tokens);

  for (const stack of ctx.designStacks ?? []) {
    const output = exportStack(stack.id, tokens, { package: stack.package });
    for (const file of output.files) {
      const path = projectFilePath(stack.files, file);
      if (!isSafeRelative(path)) continue;
      const actual = ctx.readSource ? ctx.readSource(path) : null;
      const outcome = compareFile(file, actual);
      if (outcome.state === 'in_sync') continue;
      const changed = outcome.diff.split('\n').filter((line) => /^[-+] /.test(line)).length;
      const reason = outcome.state === 'missing' ? 'файла нет' : `расходится с выгрузкой (строк различий: ${changed})`;
      found.push(violation('design_theme_drift', null, path,
        `Файл темы \`${path}\` (${STACK_LABEL[stack.id]}): ${reason}. Выгрузка и дифф — на экране «Дизайн», вкладка «Стеки»; файл меняет задача, а не приложение.`));
    }
  }

  const names = design.tokens.components.map((item) => item.value.name);
  const missing = componentsMissing(names, [...ctx.code.files], providedComponents(ctx.designStacks));
  for (const name of missing ?? []) {
    found.push(violation('design_component_missing', null, '',
      `Компонент \`${name}\` из реестра дизайна не найден среди файлов \`sources.code\` проекта.`));
  }
  return found;
}

/**
 * Находки проверки экранов моделью (docs/16-design-system.md): действует
 * последний принятый отчёт каждого прохода. Модель только находила — правка
 * идёт обычной задачей, поэтому находка называет экран, ширину и тему.
 */
export function designScreenFindings(ctx: RuleContext): Violation[] {
  const latest = latestReports(ctx.designReports ?? []);
  const found: Violation[] = [];
  for (const pass of ['responsive', 'pixel'] as const) {
    for (const item of latest[pass]?.findings ?? []) {
      const detail = [item.expected ? `ожидалось: ${item.expected}` : '', item.actual ? `на снимке: ${item.actual}` : '']
        .filter((part) => part !== '').join('; ');
      found.push(violation('design_screen_finding', null, '',
        `${PASS_LABEL[pass]} · экран \`${item.screen}\` · ${item.width} px · тема ${item.theme}: ${item.what}${detail ? ` (${detail})` : ''}.`));
    }
  }
  return found;
}

/** Не сказано, что за изменение, — значит непонятно, нужна ли карта. */
export function changeMissing(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (!TASK_READY_AND_BEYOND.includes(task.status)) continue;
    if (typeof task.data['change'] === 'string' && task.data['change'] !== '') continue;
    found.push(violation(
      'change_missing',
      task.id,
      task.source.path,
      `У задачи ${task.id} не указано \`change\`. Без него непонятно, нужна ли карта изменения, и правило про \`feature\` молча не применяется.`
    ));
  }
  return found;
}

/** Задача отдана модели, а дифф не разобран: работа висит, и это легко забыть. */
export function workUnreviewed(ctx: RuleContext): Violation[] {
  const unreviewed = ctx.work?.unreviewed;
  if (!unreviewed) return [];

  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (!unreviewed.has(task.id)) continue;
    found.push(violation(
      'work_unreviewed',
      task.id,
      task.source.path,
      'Задача ' + task.id + ' отдана модели, и в её ветке есть неразобранные изменения. Примите дифф, отправьте на доработку или отклоните — пока он висит, работа не сделана и не отменена.'
    ));
  }
  return found;
}

/** Ветка закрытой задачи: работа кончилась, а след остался. */
export function workBranchOrphan(ctx: RuleContext): Violation[] {
  const orphans = ctx.work?.orphanBranches;
  if (!orphans) return [];

  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'done' && task.status !== 'dropped') continue;
    if (!orphans.has(task.id)) continue;
    found.push(violation(
      'work_branch_orphan',
      task.id,
      task.source.path,
      'Задача ' + task.id + ' в статусе `' + task.status + '`, а её рабочая ветка осталась. Приложение чужих веток не удаляет — уберите, когда убедитесь, что всё слито.'
    ));
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

export function taskDoneUnverified(ctx: RuleContext, blockEmpty = false): Violation[] {
  if (!(ctx.policy.require_verification_before_done ?? DEFAULT_POLICY.require_verification_before_done)) {
    return [];
  }
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.status !== 'done') continue;
    // Закрытые раньше без проверок получают лишь предупреждение; блок — только на переходе.
    if (blockEmpty && taskVerificationIds(ctx, task).size === 0) {
      found.push(violation('task_done_unverified', task.id, task.source.path, NO_VERIFICATION_TEXT + '.'));
    }
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

/**
 * `feature`-задача закрылась, а `sources.code` в манифесте всё ещё пуст —
 * значит написанный код физически лежит в проекте, но приложение о нём не
 * знает: карта его не увидит, ссылки на файлы кода не проверятся, и
 * следующий заход в «Карты» ответит «в проекте нет файлов кода», хотя это
 * неправда. Родилось на gastrograf: код появился в `backend/`, а
 * `sources.code` остался `[]` — три задачи молча закрылись мимо манифеста.
 */
export function codeSourcesEmptyAfterFeature(ctx: RuleContext): Violation[] {
  if (ctx.code.roots.length > 0) return [];
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (task.data['change'] !== 'feature') continue;
    if (task.status !== 'in_review' && task.status !== 'done') continue;
    found.push(violation(
      'code_sources_empty_after_feature',
      task.id,
      task.source.path,
      `Задача ${task.id} — feature, дошла до \`${task.status}\`, а sources.code в манифесте пуст. Если код уже написан — назовите его каталог в манифесте, иначе карта его не увидит.`
    ));
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
    // Карта тоже держит переход, а не только попадает в список нарушений:
    // «задача не уйдёт в ready, пока карта не подтверждена» (docs/07-maps.md).
    // `change` держит переход так же, как и остальное: задача без него иначе
    // ушла бы в `ready` и тут же стала нарушителем `change_missing`.
    return [
      ...taskNotReadyDocs(scoped),
      ...taskNoRequirement(scoped),
      ...changeMissing(scoped),
      ...taskMapsUnapproved(scoped)
    ];
  }
  if (to === 'done') {
    return taskDoneUnverified(scoped, true);
  }
  return [];
}

function transitionsFor(type: string): Readonly<Record<string, readonly string[]>> | null {
  switch (type) {
    case 'requirement':
    case 'design':
    case 'contract':
    case 'verification':
    case 'reference':
    case 'defect': case 'release':
    // Карта подтверждается тем же порядком, что документ: без этого её нельзя
    // утвердить, а без утверждения не начинается работа (docs/07-maps.md).
    case 'map':
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
export function markdownLinkTargets(body: string): string[] {
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

/**
 * Все проверки задачи: свои `verified_by`, `verified_by` её требований и проверки,
 * сославшиеся на эти требования через `verifies` (связь можно объявить с любой стороны).
 */
function taskVerificationIds(ctx: RuleContext, task: WorkRecord): Set<string> {
  const ids = new Set<string>(task.links.verified_by ?? []);
  for (const requirementId of task.links.implements ?? []) {
    const requirement = ctx.graph.byId.get(requirementId);
    for (const id of requirement?.links.verified_by ?? []) ids.add(id);
    for (const edge of incomingEdges(ctx.graph, requirementId, 'verifies')) ids.add(edge.from);
  }
  return ids;
}

const NO_VERIFICATION_TEXT = 'У задачи нет ни одной проверки: ни у её требований, ни своей. Закрытая задача без проверки — обещание, а не факт';

/** Пустое множество проверок не значит «все пройдены» (ADR-0029). Предупреждение, не ошибка: прежние задачи не ломаются. */
export function taskNoVerification(ctx: RuleContext): Violation[] {
  const found: Violation[] = [];
  for (const task of tasks(ctx)) {
    if (!TASK_READY_AND_BEYOND.includes(task.status)) continue;
    if (taskVerificationIds(ctx, task).size > 0) continue;
    found.push(violation(
      'task_no_verification',
      task.id,
      task.source.path,
      'Задача ' + task.id + ' в статусе `' + task.status + '`: ' + NO_VERIFICATION_TEXT + '. Заведите проверку и свяжите её с требованием (`verified_by`).'
    ));
  }
  return found;
}

/**
 * Каталоги историй против контракта (docs/16-design-system.md, «Storybook как
 * контракт»): пробелы — `design_story_missing`, расхождение свойств и лишние
 * истории — `design_contract_drift`. Включается манифестом: нет `design.catalog`
 * и `stacks[].catalog` — нет проверки. Файлы выгрузок читает `readSource`.
 */
export function designCatalogRules(ctx: RuleContext): Violation[] {
  const design = ctx.design;
  if (!design || design.empty || !ctx.readSource) return [];
  const sources = catalogSources(
    { ...(ctx.designCatalog ? { catalog: ctx.designCatalog } : {}), stacks: ctx.designStacks },
    STACK_LABEL,
    ctx.readSource
  );
  if (sources.length === 0) return [];
  const components = design.tokens.components.map((item) => item.value);
  return buildCatalogReport(components, sources).findings.map((finding) => violation(finding.code, null, '', finding.message));
}

/**
 * Возможность must/now без владельца при включённой политике
 * `require_capability_owner` (T-0044). Только нижние возможности: владелец
 * родителя наследуется, а спрашивать с группы незачем. Политика выключена —
 * проверки нет, старые проекты не получают новых предупреждений.
 */
export function capabilityNoOwner(ctx: RuleContext): Violation[] {
  if (!ctx.policy.require_capability_owner) return [];
  const picture = foldMaps(approvedMaps(ctx.records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));
  const capabilities: (typeof picture.functional.capabilities[number] & { declaredBy?: string | undefined })[] = picture.functional.capabilities;
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const parents = new Set(capabilities.map((item) => item.parent).filter(Boolean));
  const pathOf = new Map(ctx.records.map((record) => [record.id, record.source.path]));
  return capabilities
    .filter((item) => item.declaredBy && !parents.has(item.id))
    .filter((item) => effectivePriority(item, byId)?.value === 'must' || effectiveHorizon(item, byId)?.value === 'now')
    .filter((item) => effectiveOwner(item, byId) === null)
    .map((item) => violation('capability_no_owner', item.declaredBy as string, pathOf.get(item.declaredBy as string) ?? '',
      `У возможности «${item.title ?? item.id}» (\`${item.id}\`) приоритет must или горизонт now, а владельца нет ни у неё, ни у родителей: укажите \`owner\` новой картой.`));
}

/**
 * Ссылки возможностей на узлы других карт (R-0086): узел должен существовать.
 * Предупреждение, а не ошибка: карту могли подтвердить раньше, чем появился узел.
 */
export function mapLinksBroken(ctx: RuleContext): Violation[] {
  const picture = foldMaps(approvedMaps(ctx.records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));
  const capabilities: (typeof picture.functional.capabilities[number] & { declaredBy?: string | undefined })[] = picture.functional.capabilities;
  if (!capabilities.some((item) => item.mapLinks?.length)) return [];
  const known = new Set<string>([
    ...picture.codemap.modules.map((item) => `codemap:${item.id}`),
    ...picture.dataflow.sources.map((item) => `dataflow:${item.id}`),
    ...picture.userflow.screens.map((item) => `userflow:${item.id}`),
    ...picture.custom.nodes.map((item) => `${item.map}:${item.id}`)
  ]);
  const owner = new Map(capabilities.map((item) => [item.id, item.declaredBy ?? '']));
  const pathOf = new Map(ctx.records.map((record) => [record.id, record.source.path]));
  return brokenMapLinks(capabilities, known).map((found) => violation('map_link_broken', owner.get(found.capability) ?? '', pathOf.get(owner.get(found.capability) ?? '') ?? '',
    found.reason === 'format'
      ? `У возможности \`${found.capability}\` ссылка «${found.link}» записана не по форме \`вид:узел\`.`
      : `У возможности \`${found.capability}\` ссылка «${found.link}» ведёт на узел, которого нет ни в одной подтверждённой карте.`));
}

/**
 * Контракт блока (R-0088): задача в работе затрагивает возможность, чей вход —
 * запись, не подтверждённая статусом. «Документ ведёт код» на уровне блока.
 */
export function blockInputsNotReady(ctx: RuleContext): Violation[] {
  const picture = foldMaps(approvedMaps(ctx.records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));
  const capabilities: (typeof picture.functional.capabilities[number] & { declaredBy?: string | undefined })[] = picture.functional.capabilities;
  const withInputs = capabilities.filter((item) => item.inputs?.length);
  if (withInputs.length === 0) return [];
  const status = new Map(ctx.records.map((record) => [record.id, record.status]));
  const found: Violation[] = [];
  for (const task of ctx.records) {
    if (task.type !== 'task' || (task.status !== 'in_progress' && task.status !== 'in_review')) continue;
    const touched = new Set(task.links.affects ?? []);
    for (const item of withInputs) {
      if (!item.declaredBy || !touched.has(item.declaredBy)) continue;
      const notReady = inputsNotReady(item, (id) => status.get(id) ?? null);
      if (notReady.length === 0) continue;
      found.push(violation('block_inputs_not_ready', task.id, task.source.path,
        `Задача ${task.id} в работе, а у возможности \`${item.id}\` входы не готовы: ${notReady.map((entry) => entry.why === 'missing' ? `${entry.input} (записи нет)` : `${entry.input} (${entry.status})`).join(', ')}.`));
    }
  }
  return found;
}
