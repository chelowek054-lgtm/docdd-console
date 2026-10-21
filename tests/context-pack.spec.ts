// V-0011 unit (npm run test -- tests/context-pack.spec.ts); написан по тексту R-0011 при проверке T-0027, T-0028.
import { describe, expect, it } from 'vitest';

import { buildContextPack, renderContextPack, type ContextNeeds } from '../server/lib/context-pack';
import { rec } from './helpers';

const LF = String.fromCharCode(10);
const big = (n: number) => 'x'.repeat(n);

const records = () => [
  rec('R-1', 'requirement', 'approved', { body: '# R-1' + LF + big(100), links: {} }),
  rec('T-1', 'task', 'ready', { body: '# T-1' + LF + big(100), links: { implements: ['R-1'] } }),
  rec('T-2', 'task', 'ready', { body: '# T-2' + LF + big(100), links: { depends_on: ['T-1'] } }),
  rec('D-1', 'decision', 'approved', { body: '# D-1' + LF + big(100), links: { affects: ['T-1'] }, extra: { tags: ['confidential'] } })
];
const needs: ContextNeeds = { kinds: ['record', 'links'], depth: 1, budget: 10_000 };

describe('R-0011: пакет контекста', () => {
  it('детерминирован: порядок записей на входе не меняет пакет', () => {
    const a = buildContextPack({ records: records(), centerId: 'T-1', needs });
    const b = buildContextPack({ records: records().reverse(), centerId: 'T-1', needs });
    expect(b).toEqual(a);
    expect(a.chunks[0]!.key).toBe('record:T-1');
  });

  it('режет по бюджету целыми кусками и перечисляет отрезанное', () => {
    const full = buildContextPack({ records: records(), centerId: 'T-1', needs });
    const small = buildContextPack({ records: records(), centerId: 'T-1', needs: { ...needs, budget: full.chunks[0]!.size + 5 } });
    expect(small.chunks.map((c) => c.key)).toEqual(['record:T-1']);
    expect(small.cut.length).toBe(full.chunks.length - 1);
    for (const chunk of small.chunks) expect(chunk.text.length).toBe(chunk.size);
    expect(small.cut.every((c) => c.size > 0)).toBe(true);
    expect(renderContextPack(small)).toContain('Не вошло в контекст');
  });

  it('глубина 0 не тянет связи; чего шаблон не просит, того нет', () => {
    const pack = buildContextPack({ records: records(), centerId: 'T-1', needs: { kinds: ['record'], depth: 0, budget: 9999 } });
    expect(pack.chunks.map((c) => c.key)).toEqual(['record:T-1']);
  });

  it('confidential не уходит без допуска, с допуском уходит', () => {
    const pack = buildContextPack({ records: records(), centerId: 'T-1', needs });
    expect(pack.chunks.find((c) => c.key === 'record:D-1')?.confidential).toBe(true);
    expect(renderContextPack(pack)).not.toContain('D-1');
    expect(renderContextPack(pack, { allowConfidential: true })).toContain('D-1');
  });

  it('исключённый в предпросмотре кусок не попадает в prompt', () => {
    const pack = buildContextPack({ records: records(), centerId: 'T-1', needs });
    const text = renderContextPack(pack, { exclude: new Set(['record:R-1']) });
    expect(text).not.toContain('R-1:');
    expect(text).toContain('T-2');
  });

  // Снимок на синтетическом мини-проекте: порядок, ключи и размеры куска меняются только осознанно (T-0027).
  it('снимок пакета для задачи мини-проекта', () => {
    const mini = [
      rec('R-9', 'requirement', 'approved', { body: '# R-9' + LF + 'Требование', links: {} }),
      rec('T-9', 'task', 'ready', { body: '# T-9' + LF + 'Задача', links: { implements: ['R-9'], depends_on: ['T-8'] } }),
      rec('T-8', 'task', 'done', { body: '# T-8' + LF + 'Прежняя', links: {} })
    ];
    const pack = buildContextPack({
      records: mini, centerId: 'T-9',
      needs: { kinds: ['record', 'links', 'capability', 'vision', 'reference'], depth: 1, budget: 5000 },
      capabilities: [{ id: 'c-0', title: 'Корень' }, { id: 'c-1', title: 'Лист', parent: 'c-0' }],
      capabilityIds: ['c-1'], vision: 'Контроль разработки', referenceIndex: '- модуль'
    });
    expect(pack.chunks.map((c) => `${c.rank} ${c.key} ${c.size} ${c.why}`)).toMatchInlineSnapshot(`
      [
        "0 record:T-9 12 центр запроса",
        "3 vision 19 вектор проекта",
        "5 capability:c-1 4 возможность записи",
        "6 capability:c-0 6 родитель возможности",
        "10 record:R-9 16 связь (implements: T-9 → R-9)",
        "10 record:T-8 13 связь (depends_on: T-9 → T-8)",
        "40 reference 8 что уже есть (DRY)",
      ]
    `);
    expect({ size: pack.size, cut: pack.cut }).toMatchInlineSnapshot(`
      {
        "cut": [],
        "size": 78,
      }
    `);
  });
});
