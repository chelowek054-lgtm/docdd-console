import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { customDefinitions } from '../server/lib/custom-maps';
import { industryDefinitions, researchHistory, stageMeasurements } from '../server/lib/industry-maps';
import { appendCustomMap } from '../server/lib/manifest-write';
import { customStandard, lintCustomChange, standardFor } from '../server/lib/map-core';
import { validateReport } from '../server/lib/schema';
import type { ProjectManifest, Report, WorkRecord } from '../server/lib/types';

describe('V-0163 · отраслевые карты', () => {
  it.each([
    { notation: 'gamedev', kinds: ['mechanic', 'scene'], relation: 'uses' },
    { notation: 'embedded', kinds: ['firmware', 'hardware'], relation: 'depends' }
  ])('сохраняет карту $notation с обозначениями и проверяет два узла', ({ notation, kinds, relation }) => {
    const definition = industryDefinitions().find((item) => item.notation === notation)!;
    const edit = appendCustomMap('contract: docdd.workspace/1\nproject: { id: sample, name: Sample }\n', { ...definition });
    if (!edit.ok) throw new Error(edit.message);
    const { definitions, problems } = customDefinitions(load(edit.text) as ProjectManifest);
    expect(problems).toEqual([]);
    expect(customStandard(definitions[0]!)).toBe(standardFor(notation)?.standard);

    const added = {
      nodes: kinds.map((kind, i) => ({ id: `node-${i}`, kind, title: kind, summary: `Описание ${kind}` })),
      relations: [{ from: 'node-0', to: 'node-1', type: relation }]
    };
    expect(lintCustomChange({ map: notation, added }, definitions, { nodes: [] })).toEqual([]);
    added.nodes[0]!.kind = 'unknown';
    expect(lintCustomChange({ map: notation, added }, definitions, { nodes: [] })).not.toEqual([]);
  });
});

describe('ML и развилки', () => {
  it('выводит цифры связанных проверок с идентификаторами прогонов', () => {
    const measurement = { name: 'latency', value: 42, unit: 'ms' };
    const report: Report = {
      contract: 'docdd.workspace/1', runner: 'test', started_at: '2026-11-23T10:00:00Z', run_id: 'run-42',
      verifications: { 'V-0001': 'passed', 'V-0002': 'failed' },
      measurements: { 'V-0001': [measurement] }
    };
    expect(validateReport(report)).toEqual([]);
    const stage = { inputs: [{ name: 'scene', format: 'JSON' }], outputs: [], state: 'ready', verifications: ['V-0001'] };
    expect(stageMeasurements(stage, [report])).toMatchObject([{ id: 'V-0001', run: 'run-42', measurements: [measurement] }]);
  });

  it('берёт вопрос, варианты и причину из записи и отмечает заменённую ветку', () => {
    const previous = { id: 'A-0001', type: 'decision', title: 'Первый вариант', status: 'approved', links: {}, body: '## Вопрос\nЧто выбрать?\n## Варианты\nОдин или два.' } as WorkRecord;
    const next: WorkRecord = {
      ...previous, id: 'A-0002', links: { supersedes: ['A-0001'], verified_by: ['V-0001'] },
      body: '## Решение\nВторой вариант.\n## Причина\nМеньше задержка.'
    };
    expect(researchHistory([previous, next])).toMatchObject([
      { id: 'A-0001', status: 'superseded', context: 'Что выбрать?', options: 'Один или два.' },
      { id: 'A-0002', status: 'approved', supersedes: ['A-0001'], outcome: 'Второй вариант.', reason: 'Меньше задержка.', verifications: ['V-0001'] }
    ]);
  });
});
