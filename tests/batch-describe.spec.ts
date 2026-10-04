import { describe, expect, it } from 'vitest';

import { MAX_REQUEST_FILES, batchPlan, inventoryState, portionAt, queueOf, worthAsking } from '../server/lib/inventory';
import { describeBatch, type BatchStep } from '../app/utils/batch-describe';

/** «Описать пачками» (docs/07-maps.md, «Описать всё пачками»). */

const marks = Array.from({ length: 10 }, (_, at) => ({ path: `src/f${at}.ts`, hash: `h${at}` }));

describe('порция со сдвигом', () => {
  const state = inventoryState(marks, { 'src/f0.ts': 'старый', 'src/f1.ts': 'h1' }, 4);

  it('очередь: сперва изменившееся, потом неописанное', () => {
    expect(queueOf(state)[0]).toBe('src/f0.ts');
    expect(queueOf(state)).toHaveLength(9);
  });

  it('каждый следующий заход берёт следующие файлы', () => {
    expect(portionAt(state, 0, 4).next).toEqual(queueOf(state).slice(0, 4));
    expect(portionAt(state, 4, 4).next).toEqual(queueOf(state).slice(4, 8));
    expect(portionAt(state, 8, 4).next).toHaveLength(1);
  });

  it('за пределами очереди — пусто, и спрашивать модель незачем', () => {
    expect(worthAsking(portionAt(state, 9, 4))).toBe(false);
  });

  it('исчезнувшие файлы называет только первый заход', () => {
    const withGone = inventoryState(marks, { 'src/old.ts': 'x' }, 4);
    expect(portionAt(withGone, 0, 4).gone).toEqual(['src/old.ts']);
    expect(portionAt(withGone, 4, 4).gone).toEqual([]);
  });

  it('размер запроса ограничен потолком и не меньше одного', () => {
    expect(portionAt(state, 0, 10_000).next.length).toBeLessThanOrEqual(MAX_REQUEST_FILES);
    expect(portionAt(state, 0, 0).next).toHaveLength(1);
    expect(portionAt(state, -5, 2).next).toEqual(queueOf(state).slice(0, 2));
  });
});

describe('во сколько запросов обойдётся прогон', () => {
  it('потолок за запуск и размер запроса', () => {
    expect(batchPlan(127, 40, 200)).toEqual({ files: 127, steps: 4 });
    expect(batchPlan(127, 40, 100)).toEqual({ files: 100, steps: 3 });
    expect(batchPlan(127, 50, 50)).toEqual({ files: 50, steps: 1 });
  });

  it('пустая очередь и нулевой потолок — ни одного запроса', () => {
    expect(batchPlan(0, 40, 100)).toEqual({ files: 0, steps: 0 });
    expect(batchPlan(50, 40, 0)).toEqual({ files: 0, steps: 0 });
  });
});

describe('прогон: остановка на первом отказе', () => {
  const ok = (id: string, count = 40): BatchStep => ({ ok: true, draft: id, count });

  it('все заходы прошли — итог без причины остановки', async () => {
    const seen: [number, number][] = [];
    const result = await describeBatch({
      size: 40, total: 100, left: 127,
      step: async (skip, limit) => { seen.push([skip, limit]); return ok(`M-${seen.length}`, limit); },
      stopped: () => false
    });
    expect(seen).toEqual([[0, 40], [40, 40], [80, 20]]);
    expect(result).toMatchObject({ done: 3, planned: 3, files: 100, drafts: ['M-1', 'M-2', 'M-3'], reason: null });
  });

  it('отказ — стоп, готовые черновики остаются, причина названа с номером захода', async () => {
    let call = 0;
    const result = await describeBatch({
      size: 40, total: 200, left: 200,
      step: async () => {
        call += 1;
        return call < 3 ? ok(`M-${call}`) : { ok: false, reason: 'ответ не прошёл схему' };
      },
      stopped: () => false
    });
    expect(call).toBe(3);
    expect(result.drafts).toEqual(['M-1', 'M-2']);
    expect(result.reason).toBe('ответ не прошёл схему (заход 3)');
    expect(result.files).toBe(80);
  });

  it('человек остановил — следующий заход не начинается', async () => {
    let stop = false;
    let call = 0;
    const result = await describeBatch({
      size: 10, total: 100, left: 100,
      step: async () => { call += 1; stop = true; return ok('M-1', 10); },
      stopped: () => stop
    });
    expect(call).toBe(1);
    expect(result.reason).toBe('остановлено вручную');
    expect(result.drafts).toEqual(['M-1']);
  });

  it('очередь кончилась раньше потолка — это не отказ', async () => {
    const result = await describeBatch({
      size: 40, total: 200, left: 200,
      step: async (skip) => (skip === 0 ? ok('M-1') : { ok: false, empty: true, reason: 'очередь кончилась' }),
      stopped: () => false
    });
    expect(result.reason).toBeNull();
    expect(result.drafts).toEqual(['M-1']);
  });

  it('пустая очередь — ни одного запроса к модели', async () => {
    let call = 0;
    const result = await describeBatch({
      size: 40, total: 100, left: 0,
      step: async () => { call += 1; return ok('x'); },
      stopped: () => false
    });
    expect(call).toBe(0);
    expect(result).toMatchObject({ planned: 0, done: 0, reason: null });
  });
});
