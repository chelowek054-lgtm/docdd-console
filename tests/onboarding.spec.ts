// Чек-лист «Готовность проекта» (R-0075, docs/04-ui.md, «Подключение»).
import { describe, expect, it } from 'vitest';

import { AUTO_STEPS, EMPTY_STATE, checklist, firstStep, readiness, type OnboardingState } from '../server/lib/onboarding';

const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({ ...EMPTY_STATE, sources: { ...EMPTY_STATE.sources }, ...over });

describe('чек-лист на пустом проекте', () => {
  it('все девять шагов «не начато», готовность 0 %, первый — вектор', () => {
    const steps = checklist(state());
    expect(steps).toHaveLength(9);
    expect(steps.every((step) => step.status === 'not_started')).toBe(true);
    const ready = readiness(steps);
    expect(ready).toMatchObject({ done: 0, total: 9, percent: 0 });
    expect(ready.next?.id).toBe('vision');
  });
});

describe('статус вычисляется по состоянию, а не ставится руками', () => {
  const by = (steps: ReturnType<typeof checklist>, id: string) => steps.find((step) => step.id === id)!;
  it('вектор: нет / черновик / подтверждён', () => {
    expect(by(checklist(state({ vision: 'draft' })), 'vision').status).toBe('awaiting');
    expect(by(checklist(state({ vision: 'approved' })), 'vision').status).toBe('done');
  });
  it('записи: подтверждённые — «готово», одни черновики — «ждёт подтверждения»', () => {
    expect(by(checklist(state({ contracts: 2 })), 'contracts').status).toBe('done');
    expect(by(checklist(state({ contractsDraft: 3 })), 'contracts').status).toBe('awaiting');
    expect(by(checklist(state({ testChecksDraft: 1 })), 'checks').status).toBe('awaiting');
  });
  it('требования готовы, только когда у подтверждённых есть проверки', () => {
    expect(by(checklist(state({ requirements: 4 })), 'requirements').status).toBe('awaiting');
    expect(by(checklist(state({ requirements: 4, requirementsChecked: 2 })), 'requirements').status).toBe('done');
  });
  it('источники и глоссарий — по тому, что названо и что записано', () => {
    expect(by(checklist(state({ sources: { code: 1, docs: 0, client: 0 } })), 'sources')).toMatchObject({ status: 'done', detail: expect.stringContaining('код: 1') });
    expect(by(checklist(state({ glossaryTerms: 5 })), 'glossary').status).toBe('done');
  });
  it('реальный проект: готовность и первый невыполненный шаг', () => {
    const ready = readiness(checklist(state({ vision: 'approved', capabilities: 20, maps: 3, requirements: 50, requirementsChecked: 50, glossaryTerms: 4, sources: { code: 2, docs: 1, client: 1 }, contracts: 1, references: 5 })));
    expect(ready).toMatchObject({ done: 8, total: 9, percent: 89 });
    expect(ready.next?.id).toBe('checks');
  });
});

describe('запуск и сценарии', () => {
  it('«Запустить подключение» выполняет только шаги без модели и человека', () => {
    const via = Object.fromEntries(checklist(state()).map((step) => [step.id, step.via]));
    for (const id of AUTO_STEPS) expect(via[id]).toBe('auto');
    expect(via['vision']).toBe('human');
    expect(via['maps']).toBe('model');
  });
  it('новый проект начинается с вектора, готовая кодовая база — с источников', () => {
    expect(firstStep('new')).toBe('vision');
    expect(firstStep('existing')).toBe('sources');
  });
});
