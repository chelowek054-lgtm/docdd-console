import { AREA_TITLE, ARCHITECT_AREAS, isArchitectArea, underRoot, type DomainState } from './model';

/**
 * Правила доменной карты (R-0119, R-0120): чистые функции над сложенной картой.
 * Всё — предупреждения: карта обязательна, но работу не держит (A-0004, п. 5).
 */

export type DomainCode =
  | 'domain_map_missing'
  | 'domain_capability_uncovered'
  | 'domain_module_orphan'
  | 'domain_relation_unknown'
  | 'domain_language_empty'
  | 'domain_aggregate_no_invariants'
  | 'arch_decision_missing';

export interface DomainFinding {
  code: DomainCode;
  /** Запись, на которой висит находка: карта, объявившая элемент; `null` — проект целиком. */
  record: string | null;
  message: string;
}

export interface DomainInput {
  domain: DomainState;
  /** В проекте есть код: названы папки кода или в кодовой карте есть модули. */
  hasCode: boolean;
  capabilities: readonly { id: string; title?: string | undefined; parent?: string | undefined; priority?: string | undefined; horizon?: string | undefined; declaredBy?: string | undefined }[];
  modules: readonly { id: string; path?: string | undefined; declaredBy?: string | undefined }[];
  /** Общий код (`shared`, `kernel`): контексту не принадлежит по определению. */
  common?: readonly string[];
  /** Действующие решения проекта: отставленные сюда не попадают. */
  decisions: readonly { id: string; area?: unknown }[];
}

export function domainFindings(input: DomainInput): DomainFinding[] {
  const { domain } = input;
  const found: DomainFinding[] = [];
  const empty = domain.contexts.length === 0;

  if (empty) {
    if (input.hasCode) {
      found.push({
        code: 'domain_map_missing', record: null,
        message: 'В проекте есть код, а доменной карты нет. Она обязательна и идёт второй после стратегической (A-0004): разложите код по ограниченным контекстам, их словарю и агрегатам — запись `map` с блоком `docdd-domain`.'
      });
    }
    return found;
  }

  const known = new Set(domain.contexts.map((item) => item.id));
  for (const relation of domain.relations) {
    for (const end of [relation.from, relation.to]) {
      if (known.has(end)) continue;
      found.push({
        code: 'domain_relation_unknown', record: relation.declaredBy ?? null,
        message: `Связь контекстов \`${relation.from}\` → \`${relation.to}\` (${relation.kind}) называет контекст \`${end}\`, которого в доменной карте нет.`
      });
    }
  }

  for (const context of domain.contexts) {
    if (context.kind === 'core' && (context.language ?? []).length === 0) {
      found.push({
        code: 'domain_language_empty', record: context.declaredBy ?? null,
        message: `У основного контекста \`${context.id}\` пустой словарь. Единый язык — те же слова в разговоре, документах и коде: запишите термины бизнеса и их имена в коде.`
      });
    }
  }

  for (const aggregate of domain.aggregates) {
    if ((aggregate.invariants ?? []).length > 0) continue;
    found.push({
      code: 'domain_aggregate_no_invariants', record: aggregate.declaredBy ?? null,
      message: `У агрегата \`${aggregate.id}\` не названы инварианты: непонятно, что охраняет его корень${aggregate.root ? ` \`${aggregate.root}\`` : ''}. Запишите правила целостности, которые нельзя нарушить.`
    });
  }

  // Возможность покрыта, если её или её предка взял какой-нибудь контекст.
  const covered = new Set(domain.contexts.flatMap((item) => item.capabilities ?? []));
  const parentOf = new Map(input.capabilities.map((item) => [item.id, item.parent]));
  const isCovered = (id: string): boolean => {
    const seen = new Set<string>();
    for (let at: string | undefined = id; at && !seen.has(at); at = parentOf.get(at)) {
      if (covered.has(at)) return true;
      seen.add(at);
    }
    return false;
  };
  for (const capability of input.capabilities) {
    if (capability.priority !== 'must' || capability.horizon !== 'now' || isCovered(capability.id)) continue;
    found.push({
      code: 'domain_capability_uncovered', record: capability.declaredBy ?? null,
      message: `Возможность \`${capability.id}\`${capability.title ? ` «${capability.title}»` : ''} (must, now) не отнесена ни к одному контексту доменной карты: непонятно, чья это предметная область.`
    });
  }

  const roots = domain.contexts.map((item) => item.root).filter((root): root is string => Boolean(root));
  if (roots.length > 0) {
    const outside = (path: string) => !roots.some((root) => underRoot(path, root)) && !(input.common ?? []).some((root) => underRoot(path, root));
    for (const module of input.modules) {
      const path = module.path ?? module.id;
      if (!path.includes('/') || !outside(path)) continue;
      found.push({
        code: 'domain_module_orphan', record: module.declaredBy ?? null,
        message: `Модуль \`${path}\` лежит вне корня любого контекста доменной карты. Отнесите его к контексту, к общему коду (\`shared\`, \`kernel\`) или заведите контекст.`
      });
    }
  }

  const decided = new Set(input.decisions.map((item) => item.area).filter(isArchitectArea));
  for (const area of ARCHITECT_AREAS) {
    if (decided.has(area)) continue;
    found.push({
      code: 'arch_decision_missing', record: null,
      message: `Нет решения архитектора об области «${AREA_TITLE[area]}»: ни одной записи \`decision\` с \`area: ${area}\`, даже черновика. Это выбирает архитектор (A-0004); модель может предложить варианты черновиком.`
    });
  }

  return found;
}
