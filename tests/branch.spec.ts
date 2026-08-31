import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { branchName, commitMessage, isWorkBranch, recordOfBranch, worktreePath } from '../server/lib/branch';
import { taskPrompt, TASK_MARKER } from '../server/lib/prompt';

/**
 * Имена ветки и дерева задачи и запрос на её выполнение
 * (docs/09-execution.md). Всё чистое: git здесь не запускается.
 */

const template = readFileSync(
  join(fileURLToPath(new URL('..', import.meta.url)), 'docs', 'prompts', 'task.md'),
  'utf8'
);

describe('branchName', () => {
  it('составляет имя из записи и слага', () => {
    expect(branchName('T-0007', 'Вынести веса модели клёва')).toBe('docdd/T-0007-vynesti-vesa-modeli-kleva');
  });

  it('одна запись — одно имя: повторный заход находит ту же ветку', () => {
    expect(branchName('T-0007', 'Задача')).toBe(branchName('T-0007', 'Задача'));
  });

  it('все ветки задач под одним корнем', () => {
    expect(isWorkBranch(branchName('T-0007', 'Задача'))).toBe(true);
    expect(isWorkBranch('main')).toBe(false);
    expect(isWorkBranch('feature/T-0007')).toBe(false);
  });

  it('по ветке узнаётся запись', () => {
    expect(recordOfBranch('docdd/T-0007-vynesti-vesa')).toBe('T-0007');
    expect(recordOfBranch('main')).toBeNull();
  });
});

describe('worktreePath', () => {
  it('дерево задачи лежит внутри проекта: сервер не выходит за корень', () => {
    const path = worktreePath('T-0007');
    expect(path).toBe('.docdd/worktrees/T-0007');
    expect(path.startsWith('..')).toBe(false);
  });
});

describe('commitMessage', () => {
  it('идентификатор впереди: в git log видно, чем изменение объясняется', () => {
    expect(commitMessage('T-0007', 'Вынести веса', 1)).toBe('T-0007: Вынести веса');
  });

  it('повторный заход виден в сообщении', () => {
    expect(commitMessage('T-0007', 'Вынести веса', 3)).toContain('заход 3');
  });
});

describe('taskPrompt', () => {
  const task = {
    id: 'T-0007',
    title: 'Вынести веса модели клёва',
    body: '# Вынести веса\n\nЧто делаем и чего не делаем.',
    requirements: [{ id: 'R-0004', title: 'Модель клёва', body: 'Прогноз считается по весам.' }],
    documents: [{ id: 'D-0003', title: 'Веса', body: 'Таблица весов.' }],
    map: '{"codemap":{"added":{"modules":[]}}}',
    modules: [
      { id: 'server/lib/parse.ts', title: 'Разбор', layer: 'ядро' },
      { id: 'app/pages/index.vue', title: 'Проекты', layer: 'экраны' }
    ],
    rework: '',
    round: 1
  };

  it('кладёт задачу, требование и документ целиком', () => {
    const prompt = taskPrompt(template, task);
    expect(prompt).not.toContain(TASK_MARKER);
    expect(prompt).toContain('Задача T-0007');
    expect(prompt).toContain('Прогноз считается по весам.');
    expect(prompt).toContain('Таблица весов.');
  });

  it('кладёт сжатую карту вместо обхода файлов', () => {
    const prompt = taskPrompt(template, task);
    expect(prompt).toContain('Где что лежит');
    expect(prompt).toContain('`server/lib/parse.ts` — Разбор [ядро]');
  });

  it('границы модели из запроса не пропадают', () => {
    const prompt = taskPrompt(template, task);
    // Без них модель поправит записи процесса и подтвердит себе документ.
    expect(prompt).toContain('Не трогай `docs/development`');
    expect(prompt).toContain('Не делай коммитов');
  });

  it('первый заход не говорит о доработке', () => {
    expect(taskPrompt(template, task)).not.toContain('что не так с прошлым');
  });

  it('на доработке просит править написанное, а не начинать заново', () => {
    const prompt = taskPrompt(template, { ...task, rework: 'Тесты не написаны', round: 2 });
    expect(prompt).toContain('Заход 2');
    expect(prompt).toContain('Тесты не написаны');
    expect(prompt).toContain('не начинай заново');
  });

  it('без карты и модулей запрос всё равно собирается', () => {
    const prompt = taskPrompt(template, { ...task, map: '', modules: [] });
    expect(prompt).toContain('Задача T-0007');
    expect(prompt).not.toContain('Где что лежит');
  });
});
