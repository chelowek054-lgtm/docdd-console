/**
 * Подключение проекта (R-0075, docs/04-ui.md, «Подключение»): чек-лист
 * «Готовность проекта». Каждый шаг — одно, чего не хватает консоли, чтобы вести
 * проект; статус не ставится руками, а вычисляется по состоянию проекта.
 * Чистые функции: состояние собирает `server/utils/onboarding-service.ts`.
 */

export type StepId = 'vision' | 'capabilities' | 'requirements' | 'glossary' | 'sources' | 'maps' | 'contracts' | 'references' | 'checks';

/** `not_started` — ничего нет; `awaiting` — есть черновики, ждут человека; `done` — подтверждено. */
export type StepStatus = 'not_started' | 'awaiting' | 'done';

/** Кто делает шаг: приложение само (`auto`), модель (`model`) или человек (`human`). */
export type StepVia = 'auto' | 'model' | 'human';

export interface OnboardingState {
  vision: 'none' | 'draft' | 'approved';
  /** Подтверждённых возможностей функциональной карты и карт-черновиков с ними. */
  capabilities: number;
  capabilitiesDraft: number;
  requirements: number;
  requirementsDraft: number;
  /** Подтверждённых требований, у которых есть хоть одна проверка. */
  requirementsChecked: number;
  glossaryTerms: number;
  /** Сколько папок названо в `sources`: код, клиент, документация. */
  sources: { code: number; docs: number; client: number };
  /** Подтверждённых карт со структурами кода, потоков или путей — и таких же черновиков. */
  maps: number;
  mapsDraft: number;
  contracts: number;
  contractsDraft: number;
  references: number;
  referencesDraft: number;
  /** Проверки unit/integration с командой запуска (из существующих тестов). */
  testChecks: number;
  testChecksDraft: number;
}

export interface Step {
  id: StepId;
  status: StepStatus;
  via: StepVia;
  /** Одной строкой, что именно есть сейчас: «3 из 5», «черновик ждёт подтверждения». */
  detail: string;
  /** Куда вести человека, когда шаг за ним: путь внутри проекта. */
  to: string;
}

export const EMPTY_STATE: OnboardingState = {
  vision: 'none', capabilities: 0, capabilitiesDraft: 0, requirements: 0, requirementsDraft: 0, requirementsChecked: 0,
  glossaryTerms: 0, sources: { code: 0, docs: 0, client: 0 }, maps: 0, mapsDraft: 0, contracts: 0, contractsDraft: 0,
  references: 0, referencesDraft: 0, testChecks: 0, testChecksDraft: 0
};

/** Сколько подтверждено и сколько ждёт: общий приём для шагов «записи». */
function statusOf(done: number, draft: number): StepStatus {
  if (done > 0) return 'done';
  return draft > 0 ? 'awaiting' : 'not_started';
}

/** Шаги в порядке подключения: сначала зачем, потом что, потом откуда и чем проверять. */
export function checklist(state: OnboardingState): Step[] {
  const sourcesNamed = state.sources.code + state.sources.docs + state.sources.client;
  return [
    { id: 'vision', via: 'human', to: 'maps', status: state.vision === 'approved' ? 'done' : state.vision === 'draft' ? 'awaiting' : 'not_started', detail: state.vision === 'none' ? 'вектор не записан' : state.vision === 'draft' ? 'вектор ждёт подтверждения' : 'вектор подтверждён' },
    { id: 'sources', via: 'auto', to: 'fill?tab=onboarding', status: sourcesNamed > 0 ? 'done' : 'not_started', detail: sourcesNamed > 0 ? `код: ${state.sources.code}, клиент: ${state.sources.client}, документация: ${state.sources.docs}` : 'папки не названы в project.yaml' },
    { id: 'maps', via: 'model', to: 'maps', status: statusOf(state.maps, state.mapsDraft), detail: `подтверждённых: ${state.maps}, черновиков: ${state.mapsDraft}` },
    { id: 'capabilities', via: 'model', to: 'maps', status: statusOf(state.capabilities, state.capabilitiesDraft), detail: `возможностей: ${state.capabilities}, черновиков карт: ${state.capabilitiesDraft}` },
    { id: 'requirements', via: 'model', to: 'requirements', status: state.requirements > 0 && state.requirementsChecked > 0 ? 'done' : state.requirements + state.requirementsDraft > 0 ? 'awaiting' : 'not_started', detail: `требований: ${state.requirements}, с проверками: ${state.requirementsChecked}, черновиков: ${state.requirementsDraft}` },
    { id: 'glossary', via: 'auto', to: 'glossary', status: state.glossaryTerms > 0 ? 'done' : 'not_started', detail: state.glossaryTerms > 0 ? `терминов: ${state.glossaryTerms}` : 'glossary.md пуст или не заведён' },
    { id: 'contracts', via: 'auto', to: 'documents', status: statusOf(state.contracts, state.contractsDraft), detail: `контрактов: ${state.contracts}, черновиков: ${state.contractsDraft}` },
    { id: 'references', via: 'auto', to: 'reference', status: statusOf(state.references, state.referencesDraft), detail: `справок: ${state.references}, черновиков: ${state.referencesDraft}` },
    { id: 'checks', via: 'auto', to: 'verify?tab=checks', status: statusOf(state.testChecks, state.testChecksDraft), detail: `проверок из тестов: ${state.testChecks}, черновиков: ${state.testChecksDraft}` }
  ];
}

export interface Readiness { done: number; total: number; percent: number; next: Step | null }

/** Готовность одним числом и первый шаг, до которого дошла очередь. */
export function readiness(steps: readonly Step[]): Readiness {
  const done = steps.filter((step) => step.status === 'done').length;
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0, next: steps.find((step) => step.status !== 'done') ?? null };
}

/** Шаги, которые приложение выполняет само, без модели и человека, — по ним работает «Запустить подключение». */
export const AUTO_STEPS: readonly StepId[] = ['sources', 'glossary', 'contracts', 'references', 'checks'];

/** Сценарий при заведении (R-0075): новый проект идёт через мастер, готовая кодовая база — через автопоиск. */
export type Scenario = 'new' | 'existing';

/** С какого шага начинать: новому проекту нужен вектор, готовому — источники. */
export function firstStep(scenario: Scenario): StepId {
  return scenario === 'new' ? 'vision' : 'sources';
}
