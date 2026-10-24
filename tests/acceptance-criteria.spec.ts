// V-0015: проверка по тексту требования R-0015 (файл назван в команде V-0015: tests/acceptance-criteria.spec.ts).
import { describe, expect, it } from 'vitest';

import { analystPrompt } from '../server/lib/analyst';
import { draftsFromCriteria, parseCriteria } from '../server/lib/criteria';

describe('R-0015: критерии приёмки', () => {
  const body = ['# Т', '', 'Текст.', '', '## Критерии приёмки', '', '- первый', '* [ ] второй', '1. третий', '', '## Другое', '- не критерий'].join('\n');
  it('берёт пункты раздела до следующего заголовка', () => {
    expect(parseCriteria(body)).toEqual(['первый', 'второй', 'третий']);
  });
  it('нет раздела — пусто', () => {
    expect(parseCriteria('# Т\n- пункт')).toEqual([]);
  });
  it('заводит черновики и пропускает уже имеющиеся', () => {
    const drafts = draftsFromCriteria('R-0001', ['первый', 'Второй', 'третий'], [' ПЕРВЫЙ ']);
    expect(drafts.map((d) => d.title)).toEqual(['Второй', 'третий']);
    expect(drafts.every((d) => d.verifies === 'R-0001' && d.kind === 'manual')).toBe(true);
  });
  it('помощник не повторяет записанное и подмешивает глоссарий', () => {
    const target = { id: 'R-0001', title: 'Вход', body: body + '\nЗаявка' };
    const text = analystPrompt('criteria', target, [], [{ term: 'Заявка', definition: 'обращение' }]);
    expect(text).toContain('УЖЕ ЗАПИСАНО');
    expect(text).toContain('Заявка — обращение');
  });
});
