// V-0018 (metric, npm run test -- tests/scale.spec.ts): версия записи для блокировки и замер на 5000 записей.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { generate } from '../cli/synth';
import { buildIndex } from '../server/lib/indexer';
import { versionConflict, versionOf } from '../server/lib/version';

describe('R-0018: версия записи', () => {
  const rec = { data: { id: 'T-1', status: 'draft' }, body: 'текст' };
  it('меняется от содержимого, не от даты', () => {
    expect(versionOf(rec)).toBe(versionOf({ ...rec }));
    expect(versionOf({ ...rec, body: 'другой' })).not.toBe(versionOf(rec));
    expect(versionOf({ ...rec, data: { ...rec.data, status: 'approved' } })).not.toBe(versionOf(rec));
  });
  it('устаревшая версия — конфликт; без версии — как раньше', () => {
    expect(versionConflict(rec, 'deadbeef0000')).toBe(true);
    expect(versionConflict(rec, versionOf(rec))).toBe(false);
    expect(versionConflict(rec, undefined)).toBe(false);
    expect(versionConflict(rec, '')).toBe(false);
  });
  it('синтетический проект: записи и версии собираются', () => {
    const root = mkdtempSync(join(tmpdir(), 'synth-'));
    try {
      generate(root, 5000);
      const t0 = performance.now();
      const { index } = buildIndex(root);
      // Предел в V-0018 не записан: 10 с — с запасом над замером 1,9 с из docs/15-team-platform.md.
      expect(performance.now() - t0).toBeLessThan(10_000);
      expect(index.records.length).toBe(5000);
      expect(new Set(index.records.map((r) => r.version)).size).toBe(5000);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
});

