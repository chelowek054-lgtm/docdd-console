// Контракт блока: входы и выходы (R-0088, docs/07-maps.md).
import { describe, expect, it } from 'vitest';

import { inputsNotReady } from '../server/lib/functional';

const status = (table: Record<string, string>) => (id: string) => table[id] ?? null;

describe('входы блока', () => {
  it('подтверждённая запись-вход готова', () => {
    expect(inputsNotReady({ id: 'a', inputs: ['R-0001'] }, status({ 'R-0001': 'approved' }))).toEqual([]);
    expect(inputsNotReady({ id: 'a', inputs: ['T-0001'] }, status({ 'T-0001': 'done' }))).toEqual([]);
  });
  it('неподтверждённая и несуществующая — «не готов»', () => {
    const found = inputsNotReady({ id: 'a', inputs: ['R-0001', 'R-0002'] }, status({ 'R-0001': 'draft' }));
    expect(found).toEqual([{ input: 'R-0001', why: 'unconfirmed', status: 'draft' }, { input: 'R-0002', why: 'missing' }]);
  });
  it('описание вместо номера записи не проверяется', () => {
    expect(inputsNotReady({ id: 'a', inputs: ['контракт API платежей', 'payments.api'] }, status({}))).toEqual([]);
  });
});
