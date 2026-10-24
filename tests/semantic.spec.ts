// V-0081
import { describe, expect, it } from 'vitest';

import { dot, hashEmbed, normalize, recordBlocks, TopHits, type Entry } from '../server/lib/semantic';

/** Смысловой поиск (docs/adr/0031-semantic-search.md): блоки, нормализованные векторы, лучшие N потоком. */

describe('hashEmbed', () => {
  it('вектор нормализован, косинус совпадает со скалярным произведением', () => {
    const a = hashEmbed('Ручная приёмка проверок');
    expect(dot(a, a)).toBeCloseTo(1, 6);
  });

  it('словоформы ближе друг к другу, чем чужая тема', () => {
    const query = hashEmbed('как принимаются ручные проверки');
    const near = hashEmbed('Принять вручную: ручная проверка с записью, кто проверил');
    const far = hashEmbed('Скорость отрисовки функциональной карты на клиенте');
    expect(dot(query, near)).toBeGreaterThan(dot(query, far));
  });

  it('нулевой вектор нормализуется в нули, а не в NaN', () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});

describe('recordBlocks', () => {
  const source = ['---', 'id: A-1', '---', '', '# ADR', 'Вступление.', '', '## Решение', 'Делаем так.', '', '## Решение', 'И ещё.', '', '## Журнал', '- 2026 · подтверждён'].join('\n');
  const blocks = recordBlocks({ id: 'A-1', type: 'decision', title: 'Решение о поиске' }, source);

  it('блоки по разделам, журнал и front matter не входят, ключи уникальны', () => {
    expect(blocks.map((block) => block.key)).toEqual(['A-1', 'A-1#решение', 'A-1#решение-2']);
    expect(blocks.every((block) => !block.text.includes('подтверждён') && !block.text.includes('id: A-1'))).toBe(true);
  });

  it('заголовок записи в каждом блоке, хеш меняется вместе с текстом', () => {
    expect(blocks[1]!.text.startsWith('Решение о поиске')).toBe(true);
    const changed = recordBlocks({ id: 'A-1', type: 'decision', title: 'Решение о поиске' }, source.replace('Делаем так.', 'Делаем иначе.'));
    expect(changed[1]!.hash).not.toBe(blocks[1]!.hash);
    expect(changed[0]!.hash).toBe(blocks[0]!.hash);
  });
});

describe('TopHits', () => {
  const entry = (key: string, vector: number[]): Entry => ({ key, recordId: key, type: 'task', title: key, heading: '', anchor: '', hash: '', model: 'm', snippet: '', vector });

  it('держит только лучшие N по убыванию сходства, пачками', () => {
    const top = new TopHits(2);
    top.addBatch([1, 0], [entry('a', [0.1, 0.9]), entry('b', [0.9, 0.1])]);
    top.addBatch([1, 0], [entry('c', [0.5, 0.5]), entry('d', [0, 1])]);
    expect(top.result().map((hit) => hit.key)).toEqual(['b', 'c']);
  });
});
