// V-0064
import { describe, expect, it } from 'vitest';

import { buildGraph, incomingEdges } from '../server/lib/graph';
import { parseRecord } from '../server/lib/parse';
import { checkLinks } from '../server/lib/rules';
import { validateFrontMatter } from '../server/lib/schema';
import { recordTemplate } from '../server/lib/scaffold';
import { LINK_KINDS, RECORD_TYPES } from '../server/lib/types';
import { codes, context, rec } from './helpers';

/** R-0064: релиз — version обязательна, ships ведёт на задачи, у закрытой задачи виден релиз (обратная связь). */
const release = { id: 'L-0001', type: 'release', title: 'Релиз 1.4', status: 'draft', created: '2026-10-21', updated: '2026-10-21', version: '1.4.0' };

describe('релизы и окружения (R-0064)', () => {
  it('version обязательна', () => {
    expect(validateFrontMatter(release)).toEqual([]);
    expect(validateFrontMatter({ ...release, version: undefined }).length).toBeGreaterThan(0);
  });

  it('release и ships известны контракту', () => {
    expect(RECORD_TYPES).toContain('release');
    expect(LINK_KINDS).toContain('ships');
  });

  it('шаблон релиза: version, environments, ships на задачи', () => {
    const text = recordTemplate({ id: 'L-0001', type: 'release', title: 'Релиз 1.4', today: '2026-10-21', kind: '1.4.0', environment: 'staging, prod', links: { ships: ['T-0001'] } } as never);
    const out = parseRecord(text, { path: 'releases/L-0001.md', section: 'releases' } as never);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.record.data['version']).toBe('1.4.0');
    expect(out.record.data['environments']).toEqual(['staging', 'prod']);
    expect(out.record.links.ships).toEqual(['T-0001']);
  });

  it('у закрытой задачи виден релиз: обратная связь ships в графе; ships только на задачи', () => {
    const records = [rec('L-0001', 'release', 'draft', { section: 'releases', links: { ships: ['T-0001'] } }), rec('T-0001', 'task', 'done')];
    expect(incomingEdges(buildGraph(records), 'T-0001', 'ships').map((e) => e.from)).toEqual(['L-0001']);
    expect(codes(checkLinks(context(records)))).toEqual([]);
    const bad = context([rec('L-0001', 'release', 'draft', { section: 'releases', links: { ships: ['R-0001'] } }), rec('R-0001', 'requirement', 'approved')]);
    expect(codes(checkLinks(bad))).toContain('link_wrong_type');
  });
});
