// V-0016, V-0017 (manual): подготовка человеку; тест по тексту R-0016, R-0017, отметку «Проверено» не заменяет.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { glossaryChunk, mentionedTerms, parseGlossary } from '../server/lib/glossary';
import { buildIndex } from '../server/lib/indexer';
import { breadcrumbs, knowledgeTree } from '../server/lib/knowledge';
import { failedRow, portfolioRow } from '../server/lib/portfolio';
import { buildSearchIndex, searchIndex } from '../server/lib/search';
import { claudeMd, DEFAULT_PATHS, fileNameFor, manifestYaml, recordTemplate, VISION_STUB } from '../server/lib/scaffold';


describe('R-0016: знания', () => {
  it('документы проекта в дерево не входят: у них свои пункты меню; без заметок дерево пустое', () => {
    expect(knowledgeTree([])).toEqual([]);
    expect(breadcrumbs([], 'нет')).toEqual([]);
  });
  it('заметки с путём встают деревом, крошки находят вложенную', () => {
    const tree = knowledgeTree([{ path: 'inbox/b.md', text: '# Б\nМесто в дереве страниц: А / Б.\n' }]);
    expect(breadcrumbs(tree, 'inbox/b.md')).toHaveLength(2);
    expect(tree[0]?.children[0]?.title).toBe('А');
  });
  const docs = [
    { id: 'R-1', title: 'Склад', path: 'a', type: 'requirement', text: 'отгрузка отгрузка отгрузка' },
    { id: 'R-2', title: 'Отгрузка', path: 'b', type: 'requirement', text: 'склад' }
  ];
  it('заголовок весит больше тела; начало слова находит; пустой запрос — пусто', () => {
    const index = buildSearchIndex(docs);
    expect(searchIndex(index, 'отгруз')[0]?.id).toBe('R-2');
    expect(searchIndex(index, '')).toEqual([]);
    expect(searchIndex(index, '   ')).toEqual([]);
    expect(searchIndex(index, 'отгрузка склад').length).toBe(2);
    expect(searchIndex(index, 'отгрузка нетакого')).toEqual([]);
  });
  it('глоссарий: форматы строк и попадание терминов в запрос', () => {
    const terms = parseGlossary('- **Заявка** — обращение\n**Партия**: набор\n* **Акт** - документ\nпросто текст\n');
    expect(terms.map((t) => t.term)).toEqual(['Заявка', 'Партия', 'Акт']);
    expect(mentionedTerms(terms, 'по заявке и акту').map((t) => t.term)).toEqual(['Заявка', 'Акт']);
    expect(mentionedTerms(terms, 'ничего')).toEqual([]);
    expect(glossaryChunk(terms, 'ничего')).toBeNull();
    expect(glossaryChunk(terms, 'Партия')?.kind).toBe('glossary');
  });
});

describe('R-0017: масштаб', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  function newProject(): string {
    const root = mkdtempSync(join(tmpdir(), 'docdd-r17-'));
    dirs.push(root);
    const dev = join(root, 'docs', 'development');
    for (const folder of Object.values(DEFAULT_PATHS)) mkdirSync(join(dev, folder), { recursive: true });
    writeFileSync(join(dev, 'project.yaml'), manifestYaml({ id: 'novyj', name: 'Новый' }), 'utf8');
    const today = '2026-10-21';
    writeFileSync(join(dev, DEFAULT_PATHS.requirements, fileNameFor('R-0001', 'Первое требование')), recordTemplate({ id: 'R-0001', type: 'requirement', title: 'Первое требование', today }), 'utf8');
    writeFileSync(join(dev, DEFAULT_PATHS.maps, fileNameFor('M-0001', 'Функциональная карта')), recordTemplate({ id: 'M-0001', type: 'map', title: 'Функциональная карта', today, vision: VISION_STUB }), 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), claudeMd({ id: 'novyj', name: 'Новый' }), 'utf8');
    return root;
  }

  it('шаблон нового проекта проходит проверку без ошибок, роли и практики на месте', () => {
    const root = newProject();
    const { index } = buildIndex(root);
    expect(index.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(manifestYaml({ id: 'x', name: 'X' }).match(/^ {2}- id: /gm)!.length).toBeGreaterThanOrEqual(3);
    expect(claudeMd({ id: 'x', name: 'X' })).toContain('Команда и практики');
    expect(portfolioRow(index).name).toBe('Новый');
  });

  it('портфель: сводка считает, нечитаемый проект даёт строку-отказ', () => {
    const { index } = buildIndex(newProject());
    const row = portfolioRow(index);
    expect(row.tasks.total).toBe(0);
    expect(row.failure).toBeUndefined();
    expect(row.lastActivity).toBe('2026-10-21');
    const bad = failedRow('x', 'X', 'нет манифеста');
    expect(bad.failure).toBe('нет манифеста');
    expect([row, bad]).toHaveLength(2);
  });
});
