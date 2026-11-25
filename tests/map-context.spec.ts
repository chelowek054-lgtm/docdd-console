import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { parseMapRecord } from '../server/lib/maps';
import { buildMapContext, missingMapContexts, targetsOfMapChange } from '../server/utils/map-context';

let root: string;
let records: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-map-context-'));
  records = join(root, 'docs', 'development');
  mkdirSync(join(records, 'maps'), { recursive: true });
  writeFileSync(join(records, 'project.yaml'), [
    'contract: docdd.workspace/1', 'project:', '  id: test', '  name: Test',
    'paths:', '  maps: maps', 'maps:', '  standards:', '    - extends: domain', '      title: Local domain'
  ].join('\n'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('issues context for each built-in map and rejects tokens for a different map, project or revision', () => {
  const names = ['functional', 'domain', 'sysdesign', 'codemap', 'dataflow', 'userflow'];
  const packets = names.map((map) => buildMapContext(root, 'test', map)!);
  expect(packets.map((packet) => packet.map)).toEqual(names);
  expect(packets.every((packet) => packet.schema && packet.standard && packet.instructions)).toBe(true);
  const token = packets[1]!.contextToken;
  expect(missingMapContexts(root, 'test', ['domain'], [])).toEqual(['domain']);
  expect(missingMapContexts(root, 'test', ['domain'], [token])).toEqual([]);
  expect(missingMapContexts(root, 'other', ['domain'], [token])).toEqual(['domain']);
  expect(missingMapContexts(root, 'test', ['sysdesign'], [token])).toEqual(['sysdesign']);
  expect(buildMapContext(root, 'test', 'domain', { offset: 10 })?.contextToken).toBe(token);
  writeFileSync(join(records, 'maps', 'M-0001-facts.md'), [
    '---', 'id: M-0001', 'type: map', 'title: Facts', 'status: approved', 'created: 2026-11-23', 'updated: 2026-11-23', '---',
    '', '~~~docdd-domain', '{"added":{"nodes":[{"id":"context","kind":"context","title":"Context"}]}}', '~~~'
  ].join('\n').replaceAll('~~~', '```'));
  expect(missingMapContexts(root, 'test', ['domain'], [token])).toEqual(['domain']);
});

it('derives every target from the parsed map blocks, including each concrete custom map', () => {
  const parsed = parseMapRecord([
    '~~~docdd-functional', '{"added":{"capabilities":[{"id":"a"}]}}', '~~~',
    '~~~docdd-custom', '{"map":"alpha","added":{"nodes":[{"id":"b"},{"map":"beta","id":"c"}]}}', '~~~'
  ].join('\n').replaceAll('~~~', '```'));
  expect(targetsOfMapChange(parsed.change, parsed.present)).toEqual(['functional', 'custom:alpha', 'custom:beta']);
});
