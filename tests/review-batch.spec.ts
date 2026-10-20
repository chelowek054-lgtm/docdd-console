import { describe, expect, it } from 'vitest';

import {
  REVIEW_BRANCH_MARKER,
  REVIEW_SETTINGS_MARKER,
  REVIEW_TASKS_MARKER,
  reviewBatchPrompt,
  type ReviewBatchTask
} from '../server/lib/prompt';

/**
 * R-0043: запрос на проверку подставляет настройки и задачи, ветку — во все
 * места, число волн считается по задачам и вместимости одной волны.
 */

const LF = String.fromCharCode(10);
const template = [
  'Шапка для человека.',
  '---',
  '## Настройки',
  REVIEW_SETTINGS_MARKER,
  '## Задачи',
  REVIEW_TASKS_MARKER,
  `1. Заведи ветку ${REVIEW_BRANCH_MARKER}.`,
  `2. Влей ${REVIEW_BRANCH_MARKER} в main.`
].join(LF);

function task(n: number, extra: Partial<ReviewBatchTask> = {}): ReviewBatchTask {
  const id = `T-${String(n).padStart(4, '0')}`;
  return { id, title: `Задача ${n}`, path: `docs/development/tasks/${id}.md`, phase: null, requirements: [], verifications: [], maps: [], ...extra };
}
const many = (count: number) => Array.from({ length: count }, (_, i) => task(i + 1));
const settings = { agents: 3, perAgent: 4, minutes: 10, branch: 'review/2026-10-20' };

describe('reviewBatchPrompt', () => {
  it('подставляет настройки и убирает маркеры и шапку для человека', () => {
    const prompt = reviewBatchPrompt(template, { agents: 2, perAgent: 5, minutes: 7, branch: 'rv/x' }, many(1));
    expect(prompt).toContain('- Агентов: 2');
    expect(prompt).toContain('не больше 5');
    expect(prompt).toContain('не больше 7');
    expect(prompt).not.toContain('Шапка для человека');
    for (const marker of [REVIEW_SETTINGS_MARKER, REVIEW_TASKS_MARKER, REVIEW_BRANCH_MARKER]) {
      expect(prompt).not.toContain(marker);
    }
  });

  it('подставляет задачи с требованиями, проверками, последним прогоном, картами и фазой', () => {
    const prompt = reviewBatchPrompt(template, settings, [
      task(1, {
        phase: 'P-02',
        requirements: [{ id: 'R-0043', title: 'Запрос' }],
        verifications: [
          { id: 'V-0043', title: 'Проверка', kind: 'unit', result: 'passed', at: '2026-10-20' },
          { id: 'V-0044', title: 'Ещё', kind: null, result: null, at: null }
        ],
        maps: [{ id: 'M-0049', title: 'Карта' }]
      }),
      task(2)
    ]);
    expect(prompt).toContain('### T-0001 — Задача 1');
    expect(prompt).toContain('Фаза: P-02');
    expect(prompt).toContain('- R-0043 — Запрос');
    expect(prompt).toContain('- V-0043 — Проверка (unit; последний прогон: passed, 2026-10-20)');
    expect(prompt).toContain('вид не указан; последний прогон: не запускалась');
    expect(prompt).toContain('M-0049 — Карта');
    expect(prompt).toContain('### T-0002 — Задача 2');
    expect(prompt).toContain('Фаза: нет');
    expect(prompt).toContain('Проверки: нет');
    expect(prompt).toContain('Карты: не указаны');
    expect(prompt).toContain('Задач на проверке: 2');
  });

  it('ветка подставляется во все места шаблона', () => {
    const prompt = reviewBatchPrompt(template, { ...settings, branch: 'review/zz' }, many(1));
    // два места в шаблоне + строка настроек
    expect(prompt.split('review/zz').length - 1).toBe(3);
    expect(prompt).toContain('Заведи ветку review/zz.');
    expect(prompt).toContain('Влей review/zz в main.');
  });

  it('значение подставляется буквально: «$&» в названии не раскрывается', () => {
    const prompt = reviewBatchPrompt(template, settings, [task(1, { title: 'цена $& и $1' })]);
    expect(prompt).toContain('### T-0001 — цена $& и $1');
  });

  const wavesOf = (prompt: string) => Number(/волн: (\d+)/.exec(prompt)?.[1]);

  it.each([
    [1, 3, 4, 1],
    [12, 3, 4, 1], // ровно одна волна
    [13, 3, 4, 2], // на одну больше
    [24, 3, 4, 2],
    [25, 3, 4, 3],
    [5, 1, 1, 5],
    [200, 10, 20, 1]
  ])('задач %i, агентов %i, на агента %i → волн %i', (count, agents, perAgent, waves) => {
    const prompt = reviewBatchPrompt(template, { agents, perAgent, minutes: 10, branch: 'b' }, many(count));
    expect(wavesOf(prompt)).toBe(waves);
    expect(prompt).toContain(`За одну волну: ${agents * perAgent}`);
  });

  it('задач нет — волн всё равно не меньше одной, без NaN', () => {
    const prompt = reviewBatchPrompt(template, settings, []);
    expect(wavesOf(prompt)).toBe(1);
    expect(prompt).toContain('Задач на проверке: 0');
  });
});

describe('маршрут review-batch (числа и ветка)', () => {
  // Маршрут — Nitro-обработчик, вне сервера его не вызвать; проверяем по исходному
  // тексту маршрута те границы, что названы в docs/03-server-api.md.
  it('границы чисел и проверка имени ветки заданы в маршруте', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('server/api/projects/[id]/prompt/index.post.ts', 'utf8');
    expect(source).toContain('bounded(body?.agents, 1, 10, 3)');
    expect(source).toContain('bounded(body?.perAgent, 1, 20, 4)');
    expect(source).toContain('bounded(body?.minutes, 1, 60, 10)');
    // Имя не начинается с «-»: в команде git оно сошло бы за опцию.
    expect(source).toContain('/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(branch)');
    expect(source).toContain("branch.includes('..')");
    expect(source).toContain("'branch_invalid'");

    // Само правило — то же выражение, что в маршруте.
    const valid = (name: string) => /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(name) && !name.includes('..');
    expect(valid('review/2026-10-20')).toBe(true);
    for (const bad of ['a b', 'a;rm -rf', 'a..b', '$(x)', 'ветка', 'a`b`', 'a\nb', '-D', '--force', '-x/y']) expect(valid(bad)).toBe(false);
  });
});
