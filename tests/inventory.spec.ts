import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { describedBy, inventoryState, portionOf, worthAsking, type FileMark } from '../server/lib/inventory';
import { parseMapRecord } from '../server/lib/maps';
import {
  fingerprint,
  inventoryOf,
  markDescribed,
  marksOf,
  readInventoryFile
} from '../server/utils/inventory-service';

/**
 * Опись файлов (docs/07-maps.md, раздел «Опись файлов»). Ради неё всё и
 * затевалось: описанное не переописывается, пустой проект называется пустым,
 * а неподтверждённый черновик не съедает файлы из очереди.
 */

const LF = String.fromCharCode(10);

const marks = (...paths: [string, string][]): FileMark[] =>
  paths.map(([path, hash]) => ({ path, hash }));

describe('состояние описи', () => {
  it('неописанный файл ждёт очереди', () => {
    const state = inventoryState(marks(['a.ts', 'h1'], ['b.ts', 'h2']), { 'a.ts': 'h1' });

    expect(state.total).toBe(2);
    expect(state.described).toEqual(['a.ts']);
    expect(state.pending).toEqual(['b.ts']);
  });

  it('изменившийся после описания — не описанный: карта про него врёт', () => {
    const state = inventoryState(marks(['a.ts', 'другой']), { 'a.ts': 'h1' });

    expect(state.changed).toEqual(['a.ts']);
    expect(state.described).toEqual([]);
  });

  it('исчезнувший файл назван отдельно: его надо объявить убранным', () => {
    const state = inventoryState(marks(['a.ts', 'h1']), { 'a.ts': 'h1', 'ушёл.ts': 'h9' });
    expect(state.gone).toEqual(['ушёл.ts']);
  });

  it('порция берёт изменившееся вперёд неописанного', () => {
    const state = inventoryState(
      marks(['новый.ts', 'h1'], ['старый.ts', 'изменился']),
      { 'старый.ts': 'было' },
      1
    );

    // Про изменившийся карта врёт прямо сейчас — он важнее.
    expect(state.next).toEqual(['старый.ts']);
  });

  it('порция ограничивает запрос, а не список', () => {
    const many = Array.from({ length: 100 }, (_, index) => [`f${index}.ts`, 'h'] as [string, string]);
    const state = inventoryState(marks(...many), {}, 40);

    expect(state.pending).toHaveLength(100);
    expect(state.next).toHaveLength(40);
  });

  it('пустому проекту нечего описывать', () => {
    const state = inventoryState([], {});
    expect(state.total).toBe(0);
    expect(worthAsking(state)).toBe(false);
  });

  it('всё описано и не менялось — к модели идти незачем', () => {
    const state = inventoryState(marks(['a.ts', 'h1']), { 'a.ts': 'h1' });
    expect(worthAsking(state)).toBe(false);
  });

  it('исчезнувшее одно уже повод спросить: карта помнит то, чего нет', () => {
    const state = inventoryState(marks(['a.ts', 'h1']), { 'a.ts': 'h1', 'ушёл.ts': 'h9' });
    expect(worthAsking(state)).toBe(true);
  });
});

describe('охват карты', () => {
  it('файлы берутся из модулей, свидетельств, источников и экранов', () => {
    const body = [
      '```docdd-codemap',
      JSON.stringify({
        added: {
          modules: [{ id: 'src/a.ts' }],
          imports: [{ from: 'src/a.ts', to: 'src/b.ts', evidence: { path: 'src/a.ts', line: 1, fragment: "from './b'" } }]
        }
      }),
      '```',
      '```docdd-userflow',
      JSON.stringify({ added: { screens: [{ id: '/', file: 'app/pages/index.vue' }] } }),
      '```'
    ].join(LF);

    const described = describedBy(parseMapRecord(body).change);
    expect(described).toContain('src/a.ts');
    expect(described).toContain('app/pages/index.vue');
    // Модуль назван, но сам файл `src/b.ts` только упомянут связью — он не описан.
    expect(described).not.toContain('src/b.ts');
  });
});

describe('опись настоящего проекта', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-inv-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  design: design',
      'sources:',
      '  code: [src]',
      ''
    ].join(LF), 'utf8');

    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;' + LF, 'utf8');
    writeFileSync(join(root, 'src', 'b.ts'), 'export const b = 2;' + LF, 'utf8');
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('видит файлы кода и считает их неописанными', () => {
    const state = inventoryOf(root);
    expect(state.total).toBe(2);
    expect(state.pending.sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('подтверждённая карта закрывает свои файлы, а не все', () => {
    const body = [
      '```docdd-codemap',
      JSON.stringify({ added: { modules: [{ id: 'src/a.ts' }] } }),
      '```'
    ].join(LF);

    expect(markDescribed(root, body)).toBe(1);

    const state = inventoryOf(root);
    expect(state.described).toEqual(['src/a.ts']);
    expect(state.pending).toEqual(['src/b.ts']);
  });

  it('правка описанного файла возвращает его в очередь', () => {
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 42;' + LF, 'utf8');

    const state = inventoryOf(root);
    expect(state.changed).toEqual(['src/a.ts']);
    // И он пойдёт в ближайший запрос: карта про него говорит неправду.
    expect(state.next[0]).toBe('src/a.ts');
  });
});

describe('отпечаток', () => {
  it('меняется вместе с содержимым и совпадает у одинакового', () => {
    expect(fingerprint('текст')).toBe(fingerprint('текст'));
    expect(fingerprint('текст')).not.toBe(fingerprint('текст.'));
  });
});

describe('кэш отпечатков', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-cache-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  design: design',
      'sources:',
      '  code: [src]',
      ''
    ].join(LF), 'utf8');

    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;' + LF, 'utf8');
  });

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('проход кладёт рядом с отпечатком размер и время: по ним решают, читать ли', () => {
    inventoryOf(root);

    const saved = readInventoryFile(root);
    const note = saved.files['src/a.ts'];
    expect(note).toBeDefined();
    expect(note?.size).toBeGreaterThan(0);
    expect(note?.mtime).toBeGreaterThan(0);
    expect(note?.hash).toBe(fingerprint('export const a = 1;' + LF));
  });

  it('совпал ориентир — содержимое не читается: берётся прошлый отпечаток', () => {
    // Подменяем содержимое, оставив размер и время прежними. Так делать нельзя
    // никому, кроме теста: это и есть проверка, что файл не перечитан.
    const before = statSync(join(root, 'src', 'a.ts'));
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 9;' + LF, 'utf8');
    utimesSync(join(root, 'src', 'a.ts'), before.atime, before.mtime);

    const marks = marksOf(root);
    // Отпечаток остался прежним — значит содержимое не перечитывали.
    expect(marks[0]?.hash).toBe(fingerprint('export const a = 1;' + LF));
  });

  it('разошёлся ориентир — отпечаток пересчитывается', () => {
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 12345;' + LF, 'utf8');

    const marks = marksOf(root);
    expect(marks[0]?.hash).toBe(fingerprint('export const a = 12345;' + LF));
  });

  it('старый плоский вид описи читается как описанное: записанное не пропадает', () => {
    writeFileSync(
      join(root, '.docdd', 'maps-index.json'),
      JSON.stringify({ 'src/a.ts': 'старый-отпечаток' }),
      'utf8'
    );

    const saved = readInventoryFile(root);
    expect(saved.described['src/a.ts']).toBe('старый-отпечаток');
    expect(saved.files).toEqual({});
  });
});

describe('размер порции', () => {
  it('берётся из манифеста: у каждого проекта он свой', () => {
    expect(portionOf({ map_portion_files: 10 })).toBe(10);
  });

  it('без указания — сорок', () => {
    expect(portionOf(undefined)).toBe(40);
    expect(portionOf({})).toBe(40);
  });

  it('бессмысленное значение не принимается: ноль порций — это остановка', () => {
    expect(portionOf({ map_portion_files: 0 })).toBe(40);
    expect(portionOf({ map_portion_files: -5 })).toBe(40);
    expect(portionOf({ map_portion_files: 2.5 })).toBe(40);
  });

  it('проект, назвавший свою порцию, получает её', () => {
    const root = mkdtempSync(join(tmpdir(), 'docdd-portion-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });

    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: demo',
      '  name: Demo',
      'paths:',
      '  design: design',
      'sources:',
      '  code: [src]',
      'policy:',
      '  map_portion_files: 2',
      ''
    ].join(LF), 'utf8');

    for (const name of ['a.ts', 'b.ts', 'c.ts', 'd.ts']) {
      writeFileSync(join(root, 'src', name), `export const x = '${name}';` + LF, 'utf8');
    }

    const state = inventoryOf(root);
    expect(state.portion).toBe(2);
    expect(state.next).toHaveLength(2);
    expect(state.pending).toHaveLength(4);

    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });
});
