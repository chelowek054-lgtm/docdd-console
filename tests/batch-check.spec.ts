// Сверка пачки: пробелы функции и метки заметок (R-0092, docs/10-inbox.md).
import { describe, expect, it } from 'vitest';

import { batchGaps, checkRunnable, noteMeta, requirementGaps, taskGaps } from '../server/lib/batch-check';
import type { WorkRecord } from '../server/lib/types';

const rec = (id: string, type: string, status: string, o: { links?: WorkRecord['links']; data?: Record<string, unknown>; body?: string } = {}) =>
  ({ id, type, status, links: o.links ?? {}, data: o.data ?? {}, body: o.body ?? '' }) as Pick<WorkRecord, 'id' | 'type' | 'status' | 'links' | 'data' | 'body'>;

describe('пробелы требования', () => {
  it('нет проверки и нет задачи', () => {
    const kinds = requirementGaps(rec('R-1', 'requirement', 'approved'), [rec('R-1', 'requirement', 'approved')]).map((g) => g.kind);
    expect(kinds).toEqual(['requirement_no_check', 'requirement_no_task']);
  });
  it('связь с любой стороны: verified_by у требования и verifies у проверки', () => {
    const task = rec('T-1', 'task', 'ready', { links: { implements: ['R-1'] } });
    const a = [rec('R-1', 'requirement', 'approved', { links: { verified_by: ['V-1'] } }), rec('V-1', 'verification', 'approved', { data: { command: 'npm test' } }), task];
    const b = [rec('R-1', 'requirement', 'approved'), rec('V-1', 'verification', 'approved', { data: { command: 'npm test' }, links: { verifies: ['R-1'] } }), task];
    expect(requirementGaps(a[0]!, a)).toEqual([]);
    expect(requirementGaps(b[0]!, b)).toEqual([]);
  });
  it('снятые с работы пробелов не имеют', () => {
    expect(requirementGaps(rec('R-1', 'requirement', 'superseded'), [])).toEqual([]);
  });
});

describe('проверка, которую можно прогнать', () => {
  it('автоматическая — по команде', () => {
    expect(checkRunnable(rec('V-1', 'verification', 'approved', { data: { kind: 'unit', command: 'npm test' } }))).toBe(true);
    expect(checkRunnable(rec('V-1', 'verification', 'approved', { data: { kind: 'unit' } }))).toBe(false);
    expect(checkRunnable(rec('V-1', 'verification', 'approved', { data: { kind: 'unit' }, body: 'Проверка.\n\nЗапуск: `npm run test -- tests/x.spec.ts`.' }))).toBe(true);
  });
  it('ручная — по шагам; подсказка из заготовки не считается', () => {
    const stub = '## Шаги\n\n1. Действие — ожидаемый результат.\n\n## Ожидаемый результат\n\nЧто считается «прошла».\n';
    expect(checkRunnable(rec('V-1', 'verification', 'approved', { data: { kind: 'manual' }, body: stub }))).toBe(false);
    expect(checkRunnable(rec('V-1', 'verification', 'approved', { data: { kind: 'manual' }, body: '## Шаги\n\n1. Открыть экран — виден список.\n' }))).toBe(true);
  });
});

describe('пробелы задачи и пачки функции', () => {
  it('задача без требования', () => {
    expect(taskGaps(rec('T-1', 'task', 'ready'), []).map((g) => g.kind)).toEqual(['task_no_requirement']);
  });
  it('пачка по картам возможности: пробелы собираются без повторов', () => {
    const all = [
      rec('M-1', 'map', 'approved'),
      rec('R-1', 'requirement', 'approved'),
      rec('T-1', 'task', 'ready', { links: { affects: ['M-1'], implements: ['R-1'] } }),
      rec('T-2', 'task', 'ready', { links: { affects: ['M-1'], implements: ['R-1'] } })
    ];
    const gaps = batchGaps(all, ['M-1']);
    expect(gaps.filter((g) => g.kind === 'requirement_no_check')).toHaveLength(1);
  });
  it('чистая пачка — пустой отчёт', () => {
    const all = [
      rec('R-1', 'requirement', 'approved'),
      rec('V-1', 'verification', 'approved', { data: { command: 'npm test' }, links: { verifies: ['R-1'] } }),
      rec('T-1', 'task', 'ready', { links: { affects: ['M-1'], implements: ['R-1'] } })
    ];
    expect(batchGaps(all, ['M-1'])).toEqual([]);
  });
});

describe('метки заметки', () => {
  it('роль и функция в начале файла', () => {
    expect(noteMeta('# Тема\n\nРоль: аналитик\nФункция: maps.strategy\n\nТекст.')).toEqual({ role: 'аналитик', feature: 'maps.strategy' });
  });
  it('без меток — пусто; метка в глубине текста не считается', () => {
    expect(noteMeta('# Тема\n\nПросто текст.')).toEqual({});
    const far = Array.from({ length: 20 }, () => 'строка').join('\n') + '\nРоль: qa';
    expect(noteMeta(far)).toEqual({});
  });
});
