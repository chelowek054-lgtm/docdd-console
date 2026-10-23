import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { offVector, strategyIntentBlock } from '../server/lib/prompt';

/** Строка намерения на стратегической карте (ADR-0037). */

const TEMPLATE = readFileSync('docs/prompts/strategy-intent.md', 'utf8');

describe('раздел режима «стратегия»', () => {
  it('выбранный контур становится родителем, вектор подставлен', () => {
    const text = strategyIntentBlock(TEMPLATE, { id: 'maps', title: 'Карты' }, { problem: 'долго', not: 'не ERP' });
    expect(text).toContain('под контуром `maps` — Карты');
    expect(text).toContain('- Чего не делает: не ERP');
    expect(text).not.toContain('<!--');
    // Пояснение для людей над чертой в запрос не попадает.
    expect(text).not.toContain('Приложение добавляет этот раздел');
  });

  it('без контура — место выбирает модель; без вектора — так и сказано', () => {
    const text = strategyIntentBlock(TEMPLATE, null, null);
    expect(text).toContain('под подходящим контуром');
    expect(text).toContain('Вектор проекта не записан');
  });

  it('требует запись map, требования, проверки и задачи', () => {
    const text = strategyIntentBlock(TEMPLATE, null, null);
    for (const word of ['`map`', '`requirement`', '`verification`', '`task`', '"affects"']) expect(text).toContain(word);
  });
});

describe('ВНЕ ВЕКТОРА', () => {
  it('первая строка с пометкой — причина', () => {
    expect(offVector('ВНЕ ВЕКТОРА: это ERP\n```docdd-records\n{}\n```')).toBe('это ERP');
  });
  it('пометка не первой строкой не считается', () => {
    expect(offVector('Вот записи.\nВНЕ ВЕКТОРА: нет')).toBeNull();
    expect(offVector('```docdd-records\n{}\n```')).toBeNull();
  });
});
