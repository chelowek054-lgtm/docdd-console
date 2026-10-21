// V-0063
import { describe, expect, it } from 'vitest';

import { parseRecord } from '../server/lib/parse';
import { checkLinks } from '../server/lib/rules';
import { validateFrontMatter, validateProject } from '../server/lib/schema';
import { recordTemplate } from '../server/lib/scaffold';
import { codes, context, rec } from './helpers';

/** R-0063: дефект — серьёзность обязательна, связи found_by/fixed_by/breaks, старые проекты без paths.defects. */
const defect = { id: 'B-0001', type: 'defect', title: 'Падает', status: 'draft', created: '2026-10-21', updated: '2026-10-21', severity: 'major' };

describe('запись о дефекте (R-0063)', () => {
  it('серьёзность обязательна и из списка', () => {
    expect(validateFrontMatter(defect)).toEqual([]);
    expect(validateFrontMatter({ ...defect, severity: undefined }).length).toBeGreaterThan(0);
    expect(validateFrontMatter({ ...defect, severity: 'ужас' }).length).toBeGreaterThan(0);
  });

  it('шаблон дефекта читается и содержит серьёзность, окружение, сборку, связи', () => {
    const text = recordTemplate({
      id: 'B-0001', type: 'defect', title: 'Падает', today: '2026-10-21', kind: 'critical', environment: 'staging', build: '1.4.0',
      links: { found_by: ['V-0001'], fixed_by: ['T-0001'], breaks: ['R-0001'] }
    } as never);
    const out = parseRecord(text, { path: 'defects/B-0001.md', section: 'defects' } as never);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.record.data['severity']).toBe('critical');
    expect(out.record.data['environment']).toBe('staging');
    expect(out.record.data['build']).toBe('1.4.0');
    expect(out.record.links.found_by).toEqual(['V-0001']);
    expect(out.record.links.fixed_by).toEqual(['T-0001']);
    expect(out.record.links.breaks).toEqual(['R-0001']);
    expect(validateFrontMatter(out.record.data)).toEqual([]);
  });

  it('связи дефекта допустимы к своим типам и недопустимы к чужим', () => {
    const ok = context([
      rec('B-0001', 'defect', 'draft', { section: 'defects', links: { found_by: ['V-0001'], fixed_by: ['T-0001'], breaks: ['R-0001'] } }),
      rec('V-0001', 'verification', 'approved'), rec('T-0001', 'task', 'ready'), rec('R-0001', 'requirement', 'approved')
    ]);
    expect(codes(checkLinks(ok))).toEqual([]);
    const bad = context([rec('B-0001', 'defect', 'draft', { section: 'defects', links: { fixed_by: ['R-0001'] } }), rec('R-0001', 'requirement', 'approved')]);
    expect(codes(checkLinks(bad))).toContain('link_wrong_type');
  });

  it('старый манифест без paths.defects читается', () => {
    expect(validateProject({ contract: 'docdd.workspace/1', project: { id: 'p', name: 'P' }, paths: { requirements: 'requirements' } })).toEqual([]);
  });
});
