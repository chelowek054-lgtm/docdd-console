// V-0061
import { describe, expect, it } from 'vitest';

import { isManualKind, manualReportText, parseCheckSteps } from '../server/lib/manual-report';

/** R-0061: шаги и ожидаемый результат разбираются из проверки и попадают в отчёт. */
const NOW = new Date('2026-10-21T10:00:00Z');
const body = '# Проверка\n\n## Шаги\n\n1. Открыть экран -> Виден список\n2. Нажать «Создать» => Открылась форма\n- Закрыть окно\n\n## Ожидаемый результат\n\nВсё закрылось без ошибок.\n';

describe('шаги проверки (R-0061)', () => {
  it('manual и review — ручные виды', () => {
    expect(isManualKind('manual')).toBe(true);
    expect(isManualKind('review')).toBe(true);
    expect(isManualKind('unit')).toBe(false);
  });

  it('шаги с ожиданием; общий результат уходит последнему шагу без своего', () => {
    expect(parseCheckSteps(body)).toEqual([
      { text: 'Открыть экран', expected: 'Виден список' },
      { text: 'Нажать «Создать»', expected: 'Открылась форма' },
      { text: 'Закрыть окно', expected: 'Всё закрылось без ошибок.' }
    ]);
  });

  it('без раздела «Шаги» шагов нет', () => {
    expect(parseCheckSteps('# П\n\n- пункт\n')).toEqual([]);
  });

  it('шаги попадают в отчёт; без шагов отчёт прежний', () => {
    const steps = parseCheckSteps(body).map((s) => ({ ...s, state: 'passed' as const }));
    const withSteps = JSON.parse(manualReportText('V-1', 'passed', 'qa', NOW, { steps }));
    expect(withSteps.steps).toHaveLength(3);
    expect(withSteps.steps[0]).toMatchObject({ text: 'Открыть экран', state: 'passed' });
    expect(JSON.parse(manualReportText('V-1', 'passed', 'qa', NOW))).not.toHaveProperty('steps');
    expect(JSON.parse(manualReportText('V-1', 'passed', 'qa', NOW, { steps: [] }))).not.toHaveProperty('steps');
  });
});
