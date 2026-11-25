import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadMapPresentation, mapKeysForChange, parseLayoutPublication, publishMapLayout, recordMapApproval } from '../server/lib/map-presentation';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'docdd-map-presentation-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('publishes a view transactionally, preserves other views and rejects a stale revision', () => {
  const positions = { node: { x: -120.5, y: 210 } };
  expect(loadMapPresentation(root, 'sysdesign')).toEqual({ revision: 0, views: {}, history: [] });
  expect(publishMapLayout(root, { map: 'sysdesign', view: 'root', revision: 0, positions }, 'alice')?.revision).toBe(1);
  expect(publishMapLayout(root, { map: 'sysdesign', view: 'group', revision: 0, positions }, 'bob')).toBeNull();
  const next = publishMapLayout(root, { map: 'sysdesign', view: 'group', revision: 1, positions }, 'bob');
  expect(next?.views).toEqual({ root: positions, group: positions });
  expect(loadMapPresentation(root, 'sysdesign')).toEqual(next);
  expect(next?.history.map(({ accountId }) => accountId)).toEqual(['bob', 'alice']);
  expect(loadMapPresentation(root, 'domain').history).toEqual([]);
});

it('retains the latest 100 events and assigns structure history to the affected maps', () => {
  const text = [
    '```docdd-domain', '{"added":{"nodes":[{"id":"domain"}]}}', '```',
    '```docdd-functional', '{"added":{"capabilities":[{"id":"strategy"}]}}', '```',
    '```docdd-custom', '{"map":"Team-1","added":{"nodes":[{"id":"item"}]}}', '```'
  ].join('\n');
  expect(mapKeysForChange(text)).toEqual(['strategy', 'domain', 'custom:Team-1']);
  for (let i = 0; i < 101; i++) {
    publishMapLayout(root, { map: 'domain', view: 'overview', revision: i, positions: {} }, `user-${i}`);
  }
  const when = new Date('2026-11-24T12:00:00Z');
  recordMapApproval(root, 'M-0150', text, 'reviewer', when);
  const domain = loadMapPresentation(root, 'domain');
  expect(domain.history).toHaveLength(100);
  expect(domain.history[0]).toEqual({ at: when.toISOString(), accountId: 'reviewer', kind: 'structure', recordId: 'M-0150' });
  expect(domain.history.at(-1)?.accountId).toBe('user-2');
  expect(loadMapPresentation(root, 'strategy').history).toEqual(domain.history.slice(0, 1));
  expect(loadMapPresentation(root, 'custom:Team-1').history).toEqual(domain.history.slice(0, 1));
  expect(loadMapPresentation(root, 'custom:team-1').history).toEqual([]);
});

it('validates coordinates, and retains unknown fields of an existing map presentation', () => {
  expect(parseLayoutPublication({ map: '../other', view: 'root', revision: 0, positions: {} })).toBeUndefined();
  expect(parseLayoutPublication({ map: 'domain', view: 'root', revision: 0, positions: { node: { x: Infinity, y: 1 } } })).toBeUndefined();
  const request = { map: 'domain', view: 'root', revision: 0, positions: { node: { x: 1, y: 2 } } };
  expect(parseLayoutPublication({ ...request, actor: 'impersonated' })).toEqual(request);
  publishMapLayout(root, request, 'alice');
  const file = join(root, 'docs/development/maps/presentation/domain.json');
  const saved = JSON.parse(readFileSync(file, 'utf8')) as object;
  writeFileSync(file, JSON.stringify({ ...saved, extension: ['kept'] }));
  publishMapLayout(root, { ...request, revision: 1 }, 'alice');
  expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ extension: ['kept'] });
});
