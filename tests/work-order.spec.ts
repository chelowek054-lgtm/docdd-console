import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { priorityPrompt, VISION_MARKER, ORDER_PHASES_MARKER } from '../server/lib/prompt';
import type { IndexRecord } from '../server/lib/types';
import { hasRanks, membersOf, normalizePlan, parsePriority, rankOf, sortPhases, sortTasks } from '../server/lib/work-order';
import { applyPriority } from '../server/utils/priority-service';

/** Порядок по важности (docs/04-ui.md, «Порядок по важности»; docs/02-workspace-contract.md, «Порядок фаз»). */

function record(id: string, type: string, extra: Partial<IndexRecord> & { rank?: number; depends?: string[] } = {}): IndexRecord {
  const { rank, depends, ...rest } = extra;
  return {
    id, type, title: `Запись ${id}`, status: type === 'phase' ? 'planned' : 'backlog', owner: null, created: null, updated: null,
    phase: null, tags: [], path: `docs/development/${type}/${id}.md`, section: null,
    links: { ...(depends ? { depends_on: depends } : {}), ...(rest.links ?? {}) }, backlinks: {},
    extra: rank ? { rank } : {}, ...rest
  } as IndexRecord;
}

const phaseA = record('P-0001', 'phase', { rank: 2, links: { covers: ['T-0002', 'T-0001'] } });
const phaseB = record('P-0002', 'phase', { rank: 1, links: { covers: ['T-0003'] } });
const tasks = [
  record('T-0001', 'task'), record('T-0002', 'task'), record('T-0003', 'task'),
  record('T-0004', 'task', { phase: 'P-0001' }), record('T-0005', 'task')
];
const all = [phaseA, phaseB, ...tasks];

describe('порядок в файлах', () => {
  it('rank — целое от 1; иначе порядка нет', () => {
    expect(rankOf(phaseA)).toBe(2);
    expect(rankOf(record('P-0009', 'phase'))).toBeNull();
    expect(rankOf(record('P-0009', 'phase', { extra: { rank: 0 } as never }))).toBeNull();
    expect(rankOf(record('P-0009', 'phase', { extra: { rank: 1.5 } as never }))).toBeNull();
    expect(hasRanks(all)).toBe(true);
    expect(hasRanks([record('P-0009', 'phase')])).toBe(false);
  });

  it('состав фазы: сперва covers в его порядке, затем задачи с полем phase', () => {
    expect(membersOf(phaseA, all).map((task) => task.id)).toEqual(['T-0002', 'T-0001', 'T-0004']);
  });

  it('фазы по важности — по rank, без rank в конце; «по номеру» возвращает прежний вид', () => {
    const noRank = record('P-0003', 'phase');
    expect(sortPhases([phaseA, noRank, phaseB], rankOf, 'importance').map((phase) => phase.id)).toEqual(['P-0002', 'P-0001', 'P-0003']);
    expect(sortPhases([phaseA, noRank, phaseB], rankOf, 'id').map((phase) => phase.id)).toEqual(['P-0001', 'P-0002', 'P-0003']);
  });

  it('задачи по важности: по месту фазы и месту в составе; вне фаз — в конце', () => {
    expect(sortTasks(tasks, all, 'importance').map((task) => task.id)).toEqual(['T-0003', 'T-0002', 'T-0001', 'T-0004', 'T-0005']);
    expect(sortTasks(tasks, all, 'id').map((task) => task.id)).toEqual(['T-0001', 'T-0002', 'T-0003', 'T-0004', 'T-0005']);
  });
});

const FENCE = String.fromCharCode(96).repeat(3);
const answer = (value: unknown) => ['Пара строк.', FENCE + 'docdd-order', JSON.stringify(value), FENCE].join(String.fromCharCode(10));

describe('ответ модели', () => {
  it('блока нет или он не разбирается — null: ответ остаётся текстом', () => {
    expect(parsePriority('просто текст', all)).toBeNull();
    expect(parsePriority(FENCE + 'docdd-order\n{oops\n' + FENCE, all)).toBeNull();
    expect(parsePriority(FENCE + 'docdd-order\n{"x":1}\n' + FENCE, all)).toBeNull();
  });

  it('принимает порядок и причины; задачи — объектом или просто номером', () => {
    const parsed = parsePriority(answer({
      phases: [
        { id: 'P-0002', why: 'основание', tasks: [{ id: 'T-0003', why: 'блокер' }] },
        { id: 'P-0001', why: '', tasks: ['T-0001', { id: 'T-0002', why: 'потом' }, 'T-0004'] }
      ]
    }), all);
    expect(parsed?.problems).toEqual([]);
    expect(parsed?.plan.phases.map((phase) => phase.id)).toEqual(['P-0002', 'P-0001']);
    expect(parsed?.plan.phases[0]?.tasks[0]).toEqual({ id: 'T-0003', why: 'блокер' });
    expect(parsed?.plan.phases[1]?.tasks.map((task) => task.id)).toEqual(['T-0001', 'T-0002', 'T-0004']);
  });

  it('неизвестное отбрасывается и называется; пропущенное достраивается в хвост', () => {
    const parsed = parsePriority(answer({
      phases: [{ id: 'P-0001', tasks: [{ id: 'T-9999' }, { id: 'T-0003' }, { id: 'T-0001' }] }, { id: 'P-7777', tasks: [] }]
    }), all);
    const text = (parsed?.problems ?? []).join('\n');
    expect(text).toContain('T-9999');
    expect(text).toContain('P-7777');
    expect(text).toContain('T-0003 не входит в состав P-0001');
    expect(text).toContain('Фаза P-0002 не названа');
    expect(parsed?.plan.phases.map((phase) => phase.id)).toEqual(['P-0001', 'P-0002']);
    expect(parsed?.plan.phases[0]?.tasks.map((task) => task.id)).toEqual(['T-0001', 'T-0002', 'T-0004']);
    expect(parsed?.plan.phases[1]?.tasks.map((task) => task.id)).toEqual(['T-0003']);
  });

  it('закрытое и отменённое уходит в конец своей фазы', () => {
    const done = record('T-0001', 'task', { status: 'done' } as never);
    const records = [phaseA, phaseB, done, ...all.filter((item) => item.id !== 'T-0001')];
    const plan = normalizePlan({ phases: [{ id: 'P-0001', why: '', tasks: [{ id: 'T-0001', why: '' }, { id: 'T-0002', why: '' }, { id: 'T-0004', why: '' }] }, { id: 'P-0002', why: '', tasks: [] }] }, records).plan;
    expect(plan.phases[0]?.tasks.map((task) => task.id)).toEqual(['T-0002', 'T-0004', 'T-0001']);
  });
});

describe('зависимости — жёсткое условие', () => {
  it('внутри фазы зависимая задача не встаёт раньше той, от которой зависит', () => {
    const records = [
      record('P-0001', 'phase', { links: { covers: ['T-0001', 'T-0002', 'T-0003'] } }),
      record('T-0001', 'task', { depends: ['T-0003'] }), record('T-0002', 'task'), record('T-0003', 'task')
    ];
    const parsed = normalizePlan({ phases: [{ id: 'P-0001', why: '', tasks: ['T-0001', 'T-0002', 'T-0003'].map((id) => ({ id, why: '' })) }] }, records);
    expect(parsed.plan.phases[0]?.tasks.map((task) => task.id)).toEqual(['T-0003', 'T-0001', 'T-0002']);
    expect(parsed.fixed.join('\n')).toContain('T-0003 поставлена перед T-0001');
  });

  it('цикл задач не зацикливает разбор', () => {
    const records = [
      record('P-0001', 'phase', { links: { covers: ['T-0001', 'T-0002'] } }),
      record('T-0001', 'task', { depends: ['T-0002'] }), record('T-0002', 'task', { depends: ['T-0001'] })
    ];
    const parsed = normalizePlan({ phases: [{ id: 'P-0001', why: '', tasks: [{ id: 'T-0001', why: '' }, { id: 'T-0002', why: '' }] }] }, records);
    expect(parsed.plan.phases[0]?.tasks).toHaveLength(2);
  });

  it('между фазами: фаза с основанием встаёт раньше зависимой; об этом сказано', () => {
    const records = [
      record('P-0001', 'phase', { links: { covers: ['T-0001'] } }),
      record('P-0002', 'phase', { links: { covers: ['T-0002'] } }),
      record('T-0001', 'task', { depends: ['T-0002'] }), record('T-0002', 'task')
    ];
    const parsed = normalizePlan({ phases: [
      { id: 'P-0001', why: '', tasks: [{ id: 'T-0001', why: '' }] }, { id: 'P-0002', why: '', tasks: [{ id: 'T-0002', why: '' }] }
    ] }, records);
    expect(parsed.plan.phases.map((phase) => phase.id)).toEqual(['P-0002', 'P-0001']);
    expect(parsed.fixed.join('\n')).toContain('Фаза P-0002 поставлена перед P-0001');
  });

  it('круг между фазами называется, порядок ответа сохранён', () => {
    const records = [
      record('P-0001', 'phase', { links: { covers: ['T-0001'] } }),
      record('P-0002', 'phase', { links: { covers: ['T-0002'] } }),
      record('T-0001', 'task', { depends: ['T-0002'] }), record('T-0002', 'task', { depends: ['T-0001'] })
    ];
    const parsed = normalizePlan({ phases: [
      { id: 'P-0001', why: '', tasks: [{ id: 'T-0001', why: '' }] }, { id: 'P-0002', why: '', tasks: [{ id: 'T-0002', why: '' }] }
    ] }, records);
    expect(parsed.problems.join('\n')).toContain('по кругу');
    expect(parsed.plan.phases).toHaveLength(2);
  });
});

describe('запрос', () => {
  it('вектор и фазы с задачами и их блокерами подставляются в шаблон', () => {
    const template = '# З\n\n---\n\n<!-- ВЕКТОР -->\n\n<!-- ФАЗЫ -->\n';
    const text = priorityPrompt(template, {
      vision: 'Контроль разработки по документам.',
      phases: [{ id: 'P-0001', title: 'Основа', tasks: [
        { id: 'T-0001', title: 'Модель данных', status: 'ready', change: 'feature', requirement: 'R-0001 «Данные»', dependsOn: ['T-0002'], blockers: ['карта M-0003 не подтверждена'] }
      ] }]
    });
    expect(text).toContain('Контроль разработки по документам.');
    expect(text).toContain('### P-0001 — Основа');
    expect(text).toContain('- T-0001 — Модель данных (ready · change: feature · ради: R-0001 «Данные» · зависит от T-0002 · мешает: карта M-0003 не подтверждена)');
    expect(priorityPrompt(template, { vision: '', phases: [] })).toContain('Вектор продукта не записан');
    const real = readFileSync(new URL('../docs/prompts/prioritize.md', import.meta.url), 'utf8');
    expect(real).toContain(VISION_MARKER);
    expect(real).toContain(ORDER_PHASES_MARKER);
  });
});

describe('запись порядка в файлы', () => {
  function project(): string {
    const dir = mkdtempSync(join(tmpdir(), 'docdd-priority-'));
    const dev = join(dir, 'docs/development');
    for (const folder of ['phases', 'tasks']) mkdirSync(join(dev, folder), { recursive: true });
    writeFileSync(join(dev, 'project.yaml'), 'contract: docdd.workspace/1\nproject:\n  id: t\n  name: T\npaths:\n  phases: phases\n  tasks: tasks\n');
    const phase = (id: string, covers: string) => ['---', `id: ${id}`, 'type: phase', `title: Фаза ${id}`, 'status: planned', 'created: 2026-10-08', 'updated: 2026-10-08', 'links:', `  covers: [${covers}]`, '---', '', `# Фаза ${id}`, '', '## Журнал', '', '- 2026-10-08 · заведена · architect', ''].join('\n');
    const task = (id: string) => ['---', `id: ${id}`, 'type: task', `title: Задача ${id}`, 'status: backlog', 'created: 2026-10-08', 'updated: 2026-10-08', 'links: {}', '---', '', `# Задача ${id}`, '', '## Журнал', '', '- 2026-10-08 · заведена · architect', ''].join('\n');
    writeFileSync(join(dev, 'phases/P-0001-a.md'), phase('P-0001', 'T-0001, T-0002'));
    writeFileSync(join(dev, 'phases/P-0002-b.md'), phase('P-0002', 'T-0003'));
    for (const id of ['T-0001', 'T-0002', 'T-0003']) writeFileSync(join(dev, `tasks/${id}-t.md`), task(id));
    return dir;
  }

  it('rank и covers пишутся в фазы, в журнале строка; задачи не тронуты', () => {
    const dir = project();
    try {
      const outcome = applyPriority(dir, { phases: [
        { id: 'P-0002', why: '', tasks: [{ id: 'T-0003', why: '' }] },
        { id: 'P-0001', why: '', tasks: [{ id: 'T-0002', why: '' }, { id: 'T-0001', why: '' }] }
      ] }, 'architect');
      expect(outcome).toEqual({ ok: true, changed: ['P-0002', 'P-0001'] });

      const first = readFileSync(join(dir, 'docs/development/phases/P-0002-b.md'), 'utf8');
      const second = readFileSync(join(dir, 'docs/development/phases/P-0001-a.md'), 'utf8');
      expect(first).toContain('rank: 1');
      expect(second).toContain('rank: 2');
      expect(second).toContain('covers: [T-0002, T-0001]');
      expect(second).toContain('порядок по важности обновлён · architect');
      expect(readFileSync(join(dir, 'docs/development/tasks/T-0001-t.md'), 'utf8')).not.toContain('rank');

      // Повторное применение того же порядка файлов не меняет.
      const again = applyPriority(dir, { phases: [
        { id: 'P-0002', why: '', tasks: [{ id: 'T-0003', why: '' }] },
        { id: 'P-0001', why: '', tasks: [{ id: 'T-0002', why: '' }, { id: 'T-0001', why: '' }] }
      ] }, 'architect');
      expect(again).toEqual({ ok: true, changed: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('неизвестная фаза или задача — отказ целиком, ничего не записано', () => {
    const dir = project();
    try {
      const before = readFileSync(join(dir, 'docs/development/phases/P-0001-a.md'), 'utf8');
      const outcome = applyPriority(dir, { phases: [{ id: 'P-0001', why: '', tasks: [{ id: 'T-9999', why: '' }] }] }, 'architect');
      expect(outcome.ok).toBe(false);
      expect(readFileSync(join(dir, 'docs/development/phases/P-0001-a.md'), 'utf8')).toBe(before);
      expect(existsSync(join(dir, 'docs/development/phases/P-0001-a.md'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
