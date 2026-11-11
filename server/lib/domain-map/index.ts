/**
 * Доменная карта и основа DDD + Clean (A-0004, R-0118…R-0120). Вход модуля:
 * снаружи — только отсюда (ADR-0013). Слои: `domain` — понятия и правила,
 * `application` — то, что из них собирают для экрана и проверки правил.
 */
export {
  ARCHITECT_AREAS, AREA_TITLE, CLEAN_LAYERS, CONTEXT_KINDS, CONTEXT_RELATIONS, emptyDomain, isArchitectArea, underRoot,
  type ArchitectArea, type ContextKind, type ContextRelation, type ContextRelationKind,
  type DomainAggregate, type DomainContext, type DomainPart, type DomainState, type Term
} from './domain/model';
export { architectRefusal, type ArchitectRefusal } from './domain/architect';
export { domainFindings, type DomainCode, type DomainFinding, type DomainInput } from './domain/rules';
export { contextTrees, type ContextTree, type TreeLayer, type TreeModule } from './application/tree';
export { DDD_PROFILE, profileUses } from './application/profile';
export { domainText } from './application/text';
