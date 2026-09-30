import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bulkPath } from '../server/lib/transitions';
import { bulkStatus } from '../server/utils/bulk-service';

/**
 * Массовая смена статуса: у каждой записи свой путь из её статуса, правила
 * процесса те же, что у одиночной кнопки (docs/04-ui.md, «Массовые действия»).
 */

describe('bulkPath', () => {
  const doc = (status: string) => ({ type: 'design', status });
  const task = (status: string) => ({ type: 'task', status });

  it('документ: вперёд по одному шагу, подтвердить — до approved', () => {
    expect(bulkPath(doc('draft'), 'forward')).toEqual(['review']);
    expect(bulkPath(doc('review'), 'forward')).toEqual(['approved']);
    expect(bulkPath(doc('draft'), 'approve')).toEqual(['review', 'approved']);
    expect(bulkPath(doc('review'), 'approve')).toEqual(['approved']);
  });

  it('документ: назад — в черновик из любого статуса, кроме начального', () => {
    for (const status of ['review', 'approved', 'superseded', 'dropped', 'rejected']) {
      expect(bulkPath(doc(status), 'back')).toEqual(['draft']);
    }
    expect(bulkPath(doc('draft'), 'back')).toEqual([]);
  });

  it('из подтверждённого вперёд шага нет: заменить запись — решение, а не шаг', () => {
    for (const status of ['approved', 'superseded', 'dropped']) {
      expect(bulkPath(doc(status), 'forward')).toEqual([]);
      expect(bulkPath(doc(status), 'approve')).toEqual([]);
    }
  });

  it('задача идёт по цепочке статусов и обратно', () => {
    expect(bulkPath(task('backlog'), 'forward')).toEqual(['ready']);
    expect(bulkPath(task('ready'), 'forward')).toEqual(['in_progress']);
    expect(bulkPath(task('in_progress'), 'forward')).toEqual(['in_review']);
    expect(bulkPath(task('in_review'), 'forward')).toEqual(['done']);
    expect(bulkPath(task('done'), 'forward')).toEqual([]);
    expect(bulkPath(task('done'), 'back')).toEqual(['in_review']);
    expect(bulkPath(task('dropped'), 'back')).toEqual(['backlog']);
    expect(bulkPath(task('backlog'), 'back')).toEqual([]);
  });

  it('«подтвердить» для задачи не определено, у фазы шагов нет вовсе', () => {
    expect(bulkPath(task('backlog'), 'approve')).toEqual([]);
    expect(bulkPath({ type: 'phase', status: 'planned' }, 'forward')).toEqual([]);
  });
});

const LF = String.fromCharCode(10);
let root = '';

function record(id: string, type: string, status: string, extra: string[] = []): string {
  return [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: Запись ${id}`,
    `status: ${status}`,
    'created: 2026-09-01',
    'updated: 2026-09-01',
    ...extra,
    '---',
    '',
    `# Запись ${id}`,
    '',
    'Текст.',
    '',
    '## Журнал',
    '',
    '- 2026-09-01 · заведена · architect',
    ''
  ].join(LF);
}

function put(section: string, name: string, text: string) {
  mkdirSync(join(root, 'docs', 'development', section), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', section, name), text, 'utf8');
}

function read(section: string, name: string): string {
  return readFileSync(join(root, 'docs', 'development', section, name), 'utf8');
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-bulk-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1',
    'project:',
    '  id: demo',
    '  name: Demo',
    'paths:',
    '  requirements: requirements',
    '  design: design',
    '  tasks: tasks',
    ''
  ].join(LF), 'utf8');

  put('design', 'D-0001-a.md', record('D-0001', 'design', 'draft'));
  put('design', 'D-0002-b.md', record('D-0002', 'design', 'review'));
  put('design', 'D-0003-c.md', record('D-0003', 'design', 'approved'));
  put('requirements', 'R-0001-a.md', record('R-0001', 'requirement', 'approved'));
  put('tasks', 'T-0001-a.md', record('T-0001', 'task', 'backlog', ['change: fix', 'links:', '  implements: [R-0001]']));
  put('tasks', 'T-0002-b.md', record('T-0002', 'task', 'backlog'));
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Прибирать не обязательно.
  }
});

describe('bulkStatus', () => {
  it('«подтвердить»: из черновика через review, из review сразу; approved пропущен с причиной', () => {
    const outcome = bulkStatus(root, ['D-0001', 'D-0002', 'D-0003'], 'approve', 'architect');

    expect(outcome.moved).toBe(2);
    expect(outcome.skipped).toBe(1);
    expect(outcome.results.find((item) => item.id === 'D-0001')).toMatchObject({
      ok: true, from: 'draft', to: 'approved', steps: ['review', 'approved']
    });
    expect(outcome.results.find((item) => item.id === 'D-0002')).toMatchObject({ ok: true, steps: ['approved'] });
    expect(outcome.results.find((item) => item.id === 'D-0003')).toMatchObject({
      ok: false, code: 'transition_forbidden', to: 'approved'
    });

    const text = read('design', 'D-0001-a.md');
    expect(text).toContain('status: approved');
    // Путь через review не пропускается: две строки в журнале.
    expect(text).toContain('на подтверждение · architect');
    expect(text).toContain('подтверждён · architect');
  });

  it('правила процесса те же: задача без требования в ready не уходит, остальные идут дальше', () => {
    const outcome = bulkStatus(root, ['T-0002', 'T-0001'], 'forward', 'architect');

    expect(outcome.results.find((item) => item.id === 'T-0002')).toMatchObject({
      ok: false, code: 'task_no_requirement', from: 'backlog', to: 'backlog'
    });
    expect(outcome.results.find((item) => item.id === 'T-0001')).toMatchObject({ ok: true, to: 'ready' });
    expect(read('tasks', 'T-0002-b.md')).toContain('status: backlog');
    expect(read('tasks', 'T-0001-a.md')).toContain('status: ready');
  });

  it('«назад» откатывает на шаг, незнакомый номер — отчёт, а не отказ всему запросу', () => {
    const outcome = bulkStatus(root, ['T-0001', 'X-9999', 'T-0001'], 'back', 'architect');

    expect(outcome.results).toHaveLength(2);
    expect(outcome.results.find((item) => item.id === 'T-0001')).toMatchObject({ ok: true, to: 'backlog' });
    expect(outcome.results.find((item) => item.id === 'X-9999')).toMatchObject({ ok: false, code: 'record_not_found' });
  });

  it('«подтвердить» у задачи — отказ этой записи с причиной', () => {
    const outcome = bulkStatus(root, ['T-0001'], 'approve', 'architect');
    expect(outcome.results[0]).toMatchObject({ ok: false, code: 'transition_forbidden' });
  });
});

describe('bulkStatus — не сломали ли', () => {
  it('«назад» на опоре задачи называет новое нарушение, а обычный шаг — ничего нового', () => {
    put('design', 'D-0010-opora.md', record('D-0010', 'design', 'approved'));
    put('tasks', 'T-0010-opirayetsya.md', record('T-0010', 'task', 'ready', [
      'change: fix', 'links:', '  implements: [R-0001]', '  documents: [D-0010]'
    ]));

    const quiet = bulkStatus(root, ['D-0002'], 'back', 'architect');
    expect(quiet.newIssues).toEqual([]);

    const broken = bulkStatus(root, ['D-0010'], 'back', 'architect');
    expect(broken.moved).toBe(1);
    expect(broken.newIssues.map((issue) => [issue.code, issue.recordId])).toEqual([['task_not_ready_docs', 'T-0010']]);
  });
});
