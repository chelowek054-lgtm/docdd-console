import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ProposedRecord } from '../server/lib/inbox';
import { withIntentMap } from '../server/lib/intent-map';
import { bulkStatus } from '../server/utils/bulk-service';
import { loadIndex } from '../server/utils/index-service';
import { linkIntentMap } from '../server/utils/intent-map-service';

/**
 * Карта-намерение на пачку задач: одна общая карта вместо стены «нет карты» у
 * каждой `feature`-задачи (docs/07-maps.md).
 */

const task = (key: string, change: string, links: Record<string, string[]> = {}): ProposedRecord =>
  ({ key, type: 'task', title: `Задача ${key}`, change, links });

describe('withIntentMap', () => {
  it('feature без карты — одна общая карта и affects у каждой такой задачи', () => {
    const out = withIntentMap([task('a', 'feature'), task('b', 'feature'), task('c', 'fix')], '2026-10-01');
    const map = out.find((record) => record.type === 'map');

    expect(out).toHaveLength(4);
    expect(map).toMatchObject({ intent: true, title: 'Карта изменений: пачка от 2026-10-01' });
    expect(out[0]?.links?.['affects']).toEqual([map?.key]);
    expect(out[1]?.links?.['affects']).toEqual([map?.key]);
    // fix карты не требует — связи у него нет.
    expect(out[2]?.links?.['affects']).toBeUndefined();
  });

  it('достраивает только недостающее: своя связь модели остаётся, чужие связи не теряются', () => {
    const own = withIntentMap([task('a', 'feature', { affects: ['M-0009'], implements: ['R-0001'] })], '2026-10-01');
    expect(own).toHaveLength(1);

    const mixed = withIntentMap([task('a', 'feature', { implements: ['R-0001'] })], '2026-10-01');
    expect(mixed[0]?.links).toMatchObject({ implements: ['R-0001'], affects: [mixed[1]?.key] });
  });

  it('нет feature — пачка не меняется', () => {
    const list = [task('a', 'fix'), { key: 'r', type: 'requirement', title: 'Т' } as ProposedRecord];
    expect(withIntentMap(list, '2026-10-01')).toEqual(list);
  });

  it('ключ карты не сталкивается с занятым', () => {
    const out = withIntentMap([task('intent-map-batch', 'feature')], '2026-10-01');
    expect(new Set(out.map((record) => record.key)).size).toBe(out.length);
  });
});

const LF = String.fromCharCode(10);
let root = '';

function record(id: string, type: string, status: string, extra: string[] = []): string {
  return [
    '---', `id: ${id}`, `type: ${type}`, `title: Запись ${id}`, `status: ${status}`,
    'created: 2026-09-01', 'updated: 2026-09-01', ...extra, '---', '',
    `# Запись ${id}`, '', 'Текст.', '', '## Журнал', '', '- 2026-09-01 · заведена · architect', ''
  ].join(LF);
}

function put(section: string, name: string, text: string) {
  mkdirSync(join(root, 'docs', 'development', section), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', section, name), text, 'utf8');
}

const read = (section: string, name: string) => readFileSync(join(root, 'docs', 'development', section, name), 'utf8');

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-intent-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo',
    'paths:', '  requirements: requirements', '  tasks: tasks', '  maps: maps', ''
  ].join(LF), 'utf8');

  put('requirements', 'R-0001-a.md', record('R-0001', 'requirement', 'approved'));
  for (const n of [1, 2, 3]) {
    put('tasks', `T-000${n}-a.md`, record(`T-000${n}`, 'task', 'backlog', [
      'change: feature', 'links:', '  implements: [R-0001]'
    ]));
  }
  put('tasks', 'T-0004-fix.md', record('T-0004', 'task', 'backlog', ['change: fix', 'links:', '  implements: [R-0001]']));
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Прибирать не обязательно.
  }
});

describe('linkIntentMap и отчёт массового действия', () => {
  it('«Вперёд»: feature без карты пропущена с подсказкой завести карту, fix идёт дальше', () => {
    const outcome = bulkStatus(root, ['T-0001', 'T-0002', 'T-0003', 'T-0004'], 'forward', 'architect');

    expect(outcome.moved).toBe(1);
    const stuck = outcome.results.filter((result) => !result.ok);
    expect(stuck.map((result) => result.code)).toEqual(['task_maps_unapproved', 'task_maps_unapproved', 'task_maps_unapproved']);
    expect(stuck.every((result) => result.hint === 'link_map')).toBe(true);
  });

  it('одна черновая карта-намерение на все задачи; остальные связи не теряются; fix не трогается', () => {
    const outcome = linkIntentMap(root, ['T-0001', 'T-0002', 'T-0003', 'T-0004']);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.linked).toEqual(['T-0001', 'T-0002', 'T-0003']);
    expect(outcome.skipped.map((item) => item.id)).toEqual(['T-0004']);

    const task = read('tasks', 'T-0001-a.md');
    expect(task).toContain(`affects: [${outcome.map.id}]`);
    expect(task).toContain('implements: [R-0001]');
    expect(read('tasks', 'T-0004-fix.md')).not.toContain('affects');

    const map = read('maps', outcome.map.path.split('/').pop() as string);
    expect(map).toContain('status: draft');
    expect(map).toContain('intent: true');

    // Карта разбирается: «ничего не описывает» — не повод для нарушения map_invalid.
    const issues = loadIndex(root, true).issues;
    expect(issues.filter((issue) => issue.code === 'map_invalid')).toEqual([]);
  });

  it('повторный вызов: привязывать уже нечего, и карта не плодится', () => {
    const before = loadIndex(root, true).records.filter((item) => item.type === 'map').length;
    const outcome = linkIntentMap(root, ['T-0001', 'T-0002']);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('nothing_to_link');
    expect(loadIndex(root, true).records.filter((item) => item.type === 'map').length).toBe(before);
  });

  it('после подтверждения карты «Вперёд» пускает задачи в ready', () => {
    const map = loadIndex(root, true).records.find((item) => item.type === 'map');
    bulkStatus(root, [map?.id as string], 'approve', 'architect');

    const outcome = bulkStatus(root, ['T-0001', 'T-0002', 'T-0003'], 'forward', 'architect');
    expect(outcome.moved).toBe(3);
  });
});
