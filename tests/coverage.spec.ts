import { describe, expect, it } from 'vitest';

import { capabilityConsistency } from '../server/lib/rules';
import { capabilityCoverage, capabilityFindings, mapsDeclaring } from '../server/lib/coverage';
import type { VerificationResult, WorkRecord } from '../server/lib/types';
import { codes, context, rec } from './helpers';

/**
 * Покрытие процессом и расхождения отметки с тем, что за ней стоит
 * (docs/07-maps.md, «Покрытие процессом»; docs/05-validation.md).
 */

function functionalMap(id: string, status: string, change: object, extra: Record<string, unknown> = {}): WorkRecord {
  return rec(id, 'map', status, {
    section: null,
    path: `docs/development/maps/${id}-karta.md`,
    updated: '2026-09-01',
    body: ['# Карта', '', '```docdd-functional', JSON.stringify(change), '```'].join('\n'),
    extra
  });
}

/** Карта M-0001 объявляет две возможности; задачи привязаны к ней через `affects`. */
function project(options: { tasks?: [string, string][]; status?: 'implemented' | 'partial' | 'not_implemented' | null; checks?: Record<string, VerificationResult> } = {}) {
  const status = options.status === undefined ? 'implemented' : options.status;
  const records: WorkRecord[] = [
    functionalMap('M-0001', 'approved', {
      added: {
        capabilities: [
          { id: 'shop', title: 'Магазин' },
          { id: 'shop.pay', title: 'Оплата', parent: 'shop', ...(status ? { status } : {}) }
        ]
      }
    }),
    rec('R-0001', 'requirement', 'approved', { links: { verified_by: ['V-0001'] } }),
    rec('V-0001', 'verification', 'approved', { extra: { kind: 'unit' } }),
    ...(options.tasks ?? [['T-0001', 'done']]).map(([id, taskStatus]) =>
      rec(id as string, 'task', taskStatus as string, { links: { implements: ['R-0001'], affects: ['M-0001'] } }))
  ];
  return { records, verifications: new Map(Object.entries(options.checks ?? {})) as ReadonlyMap<string, VerificationResult> };
}

describe('карты, объявлявшие возможность', () => {
  it('по added.capabilities, без отставленных', () => {
    const records = [
      functionalMap('M-0001', 'approved', { added: { capabilities: [{ id: 'a' }] } }),
      functionalMap('M-0002', 'draft', { added: { capabilities: [{ id: 'a' }, { id: 'b' }] } }),
      functionalMap('M-0003', 'dropped', { added: { capabilities: [{ id: 'a' }] } }),
      functionalMap('M-0004', 'approved', { removed: { capabilities: [{ id: 'a' }] } })
    ];
    const declared = mapsDeclaring(records);
    expect(declared.get('a')).toEqual(['M-0001', 'M-0002']);
    expect(declared.get('b')).toEqual(['M-0002']);
  });
});

describe('покрытие: цепочка возможность → карта → задача → требование → проверка', () => {
  it('считает требования, задачи и проверки', () => {
    const { records, verifications } = project({
      tasks: [['T-0001', 'done'], ['T-0002', 'in_progress'], ['T-0003', 'dropped']],
      checks: { 'V-0001': 'passed' }
    });
    const cover = capabilityCoverage({ capabilities: [{ id: 'shop.pay' }], records, verifications }).get('shop.pay');
    expect(cover?.maps).toEqual(['M-0001']);
    expect(cover?.requirements).toEqual({ total: 1, approved: 1, ids: ['R-0001'], statuses: { 'R-0001': 'approved' } });
    expect(cover?.tasks).toMatchObject({ total: 2, done: 1, active: 1 });
    expect(cover?.verifications).toEqual({ passed: 1, failed: 0, unknown: 0, ids: ['V-0001'], results: { 'V-0001': 'passed' } });
    expect(cover?.tasks.statuses).toEqual({ 'T-0001': 'done', 'T-0002': 'in_progress' });
    expect(cover?.level).toBe('verified');
  });

  it('уровень: падает → не всё → без проверки → нет следа', () => {
    const level = (checks: Record<string, VerificationResult>, tasks?: [string, string][]) => {
      const { records, verifications } = project({ checks, ...(tasks ? { tasks } : {}) });
      return capabilityCoverage({ capabilities: [{ id: 'shop.pay' }], records, verifications }).get('shop.pay')?.level;
    };
    expect(level({ 'V-0001': 'failed' })).toBe('failing');
    expect(level({})).toBe('unchecked');
    expect(level({ 'V-0001': 'skipped' })).toBe('unchecked');

    const bare = [
      functionalMap('M-0001', 'approved', { added: { capabilities: [{ id: 'a' }] } }),
      rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } })
    ];
    expect(capabilityCoverage({ capabilities: [{ id: 'a' }], records: bare, verifications: new Map() }).get('a')?.level).toBe('no_check');
    expect(capabilityCoverage({ capabilities: [{ id: 'zzz' }], records: bare, verifications: new Map() }).get('zzz')?.level).toBe('none');
  });

  it('проверка, привязанная только обратной связью verifies, тоже считается', () => {
    const records = [
      functionalMap('M-0001', 'approved', { added: { capabilities: [{ id: 'a' }] } }),
      rec('R-0001', 'requirement', 'approved'),
      rec('V-0001', 'verification', 'approved', { links: { verifies: ['R-0001'] }, extra: { kind: 'unit' } }),
      rec('T-0001', 'task', 'done', { links: { implements: ['R-0001'], affects: ['M-0001'] } })
    ];
    const cover = capabilityCoverage({ capabilities: [{ id: 'a' }], records, verifications: new Map([['V-0001', 'passed']]) }).get('a');
    expect(cover?.verifications.ids).toEqual(['V-0001']);
    expect(cover?.level).toBe('verified');
  });

  it('отставленные требования и проверки не считаются', () => {
    const records = [
      functionalMap('M-0001', 'approved', { added: { capabilities: [{ id: 'a' }] } }),
      rec('R-0001', 'requirement', 'superseded'),
      rec('T-0001', 'task', 'done', { links: { implements: ['R-0001'], affects: ['M-0001'] } })
    ];
    const cover = capabilityCoverage({ capabilities: [{ id: 'a' }], records, verifications: new Map() }).get('a');
    expect(cover?.requirements.total).toBe(0);
    expect(cover?.tasks.total).toBe(1);
  });

  it('код — группы кодовой карты с числом модулей', () => {
    const { records, verifications } = project();
    const cover = capabilityCoverage({
      capabilities: [{ id: 'shop.pay' }],
      records,
      verifications,
      groups: [{ id: 'server/pay', capability: 'shop.pay', modules: 4 }, { id: 'app/ui', capability: 'other', modules: 9 }]
    }).get('shop.pay');
    expect(cover?.code).toEqual([{ group: 'server/pay', modules: 4 }]);
  });

  it('точность — до карты: две возможности одной карты получают одни и те же задачи', () => {
    const { records, verifications } = project();
    const coverage = capabilityCoverage({ capabilities: [{ id: 'shop' }, { id: 'shop.pay' }], records, verifications });
    expect(coverage.get('shop')?.tasks.ids).toEqual(coverage.get('shop.pay')?.tasks.ids);
  });
});

describe('расхождения отметки с процессом', () => {
  const kinds = (input: ReturnType<typeof project>) => capabilityFindings(input.records, input.verifications).map((item) => item.code);

  it('«Реализовано», а ни одна задача не закрыта — отметка опередила факт', () => {
    expect(kinds(project({ tasks: [['T-0001', 'in_progress'], ['T-0002', 'ready']] }))).toEqual(['capability_ahead']);
  });

  it('одна закрытая задача из нескольких — уже не «ни одна»: молчим', () => {
    expect(kinds(project({ tasks: [['T-0001', 'done'], ['T-0002', 'in_progress']] }))).toEqual([]);
  });

  it('задач нет вовсе — молчим: отметку нечем проверять', () => {
    const input = project();
    const records = input.records.filter((record) => record.type !== 'task');
    expect(capabilityFindings(records, input.verifications)).toEqual([]);
  });

  it('все задачи закрыты, а возможность не оценена или «Не реализовано» — отметка отстала', () => {
    expect(kinds(project({ status: null }))).toEqual(['capability_behind']);
    expect(kinds(project({ status: 'not_implemented' }))).toEqual(['capability_behind']);
  });

  it('«Частично» при закрытых задачах — не отставание: сделали не всё, и это ответ', () => {
    expect(kinds(project({ status: 'partial' }))).toEqual([]);
  });

  it('проверка падает у «Реализовано» и «Частично», у «Не реализовано» — нет', () => {
    const failed = { 'V-0001': 'failed' as const };
    expect(kinds(project({ checks: failed }))).toEqual(['capability_verification_failed']);
    expect(kinds(project({ status: 'partial', checks: failed }))).toEqual(['capability_verification_failed']);
    expect(kinds(project({ status: 'not_implemented', checks: failed }))).toEqual(['capability_behind']);
  });

  it('родителя правила не касаются: у него состояние производное', () => {
    const input = project({ tasks: [['T-0001', 'in_progress']] });
    const items = capabilityFindings(input.records, input.verifications);
    expect(items.map((item) => item.capability)).toEqual(['shop.pay']);
  });

  it('читают только подтверждённые карты: черновик в картину не входит', () => {
    const input = project({ tasks: [['T-0001', 'in_progress']] });
    const records = input.records.map((record) => (record.id === 'M-0001' ? { ...record, status: 'draft' } : record));
    expect(capabilityFindings(records, input.verifications)).toEqual([]);
  });

  it('висит на карте, где возможность объявлена последней', () => {
    const input = project({ tasks: [['T-0001', 'in_progress']] });
    const remark = functionalMap('M-0002', 'approved', { added: { capabilities: [{ id: 'shop.pay', title: 'Оплата', parent: 'shop', status: 'implemented' }] } }, {});
    const later = { ...remark, data: { ...remark.data, updated: '2026-09-02' } };
    const items = capabilityFindings([...input.records, later], input.verifications);
    expect(items[0]?.map).toBe('M-0002');
  });

  it('как правило процесса: предупреждение, путь — файл карты', () => {
    const input = project({ tasks: [['T-0001', 'in_progress']] });
    const found = capabilityConsistency(context(input.records));
    expect(codes(found)).toEqual(['capability_ahead']);
    expect(found[0]).toMatchObject({ level: 'warning', id: 'M-0001', path: 'docs/development/maps/M-0001-karta.md' });
    expect(found[0]?.message).toContain('T-0001');
  });
});

describe('покрытие родителя — по нижним возможностям, без двойного счёта', () => {
  it('одна задача карты, объявившей два подпункта, у родителя одна', () => {
    const records = [
      functionalMap('M-0001', 'approved', {
        added: { capabilities: [{ id: 'g', title: 'Группа' }, { id: 'g.a', parent: 'g' }, { id: 'g.b', parent: 'g' }] }
      }),
      functionalMap('M-0002', 'approved', { added: { capabilities: [{ id: 'g.c', parent: 'g' }] } }),
      rec('T-0001', 'task', 'done', { links: { affects: ['M-0001'] } }),
      rec('T-0002', 'task', 'in_progress', { links: { affects: ['M-0002'] } })
    ];
    const caps = [{ id: 'g' }, { id: 'g.a', parent: 'g' }, { id: 'g.b', parent: 'g' }, { id: 'g.c', parent: 'g' }];
    const coverage = capabilityCoverage({ capabilities: caps, records, verifications: new Map() });
    expect(coverage.get('g.a')?.tasks.ids).toEqual(['T-0001']);
    expect(coverage.get('g.c')?.tasks.ids).toEqual(['T-0002']);
    expect(coverage.get('g')?.tasks).toMatchObject({ total: 2, done: 1, active: 1 });
    expect(coverage.get('g')?.maps.sort()).toEqual(['M-0001', 'M-0002']);
  });
});
