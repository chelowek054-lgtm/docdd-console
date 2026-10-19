import { describe, expect, it } from 'vitest';

import { memoByFingerprint } from '../server/utils/memo';

/**
 * Память производных ответов (T-0102, R-0041): пока отпечаток тот же, тяжёлый расчёт не
 * повторяется; сменился отпечаток или ключ — считается заново; ошибка не запоминается.
 */
describe('memoByFingerprint', () => {
  it('не считает заново, пока отпечаток тот же', () => {
    let runs = 0;
    const compute = () => ({ n: ++runs });
    const first = memoByFingerprint('/p/one', 'map', () => 'a', compute);
    const second = memoByFingerprint('/p/one', 'map', () => 'a', compute);
    expect(runs).toBe(1);
    expect(second).toBe(first);
  });

  it('считает заново, когда отпечаток сменился', () => {
    let runs = 0;
    memoByFingerprint('/p/two', 'map', () => 'a', () => ++runs);
    memoByFingerprint('/p/two', 'map', () => 'b', () => ++runs);
    expect(runs).toBe(2);
  });

  it('ключи и проекты не смешиваются', () => {
    const a = memoByFingerprint('/p/three', 'map', () => 'x', () => 'карта');
    const b = memoByFingerprint('/p/three', 'rules', () => 'x', () => 'правила');
    const c = memoByFingerprint('/p/four', 'map', () => 'x', () => 'другая карта');
    expect([a, b, c]).toEqual(['карта', 'правила', 'другая карта']);
  });

  it('ошибка расчёта уходит вызывающему и не запоминается', () => {
    let runs = 0;
    const boom = () => {
      runs += 1;
      throw new Error('нет');
    };
    expect(() => memoByFingerprint('/p/five', 'map', () => 'a', boom)).toThrow('нет');
    expect(() => memoByFingerprint('/p/five', 'map', () => 'a', boom)).toThrow('нет');
    expect(runs).toBe(2);
  });
});
