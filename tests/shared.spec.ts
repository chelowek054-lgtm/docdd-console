import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { availableTagsOf, narrowDomainTypes, sharedRecordsOf } from '../server/lib/shared';
import type { IndexRecord } from '../server/lib/types';
import { connectedPractices, sharedSourcesOf, toggleSourceTag } from '../server/utils/shared-service';

/**
 * Общие практики (docs/11-shared-sources.md). Здесь — только отбор, чистые
 * функции над уже построенным индексом источника (server/lib/shared.ts).
 */

function rec(id: string, type: string, status: string, tags: string[] = []): IndexRecord {
  return {
    id,
    type,
    title: `Запись ${id}`,
    status,
    owner: null,
    created: null,
    updated: null,
    phase: null,
    tags,
    path: `docs/development/${type}/${id}.md`,
    section: null,
    links: {},
    backlinks: {},
    extra: {}
  };
}

describe('sharedRecordsOf', () => {
  it('тегов не выбрано — не «всё», а ничего', () => {
    const records = [rec('D-0001', 'decision', 'approved', ['vue'])];
    expect(sharedRecordsOf(records, [])).toEqual([]);
  });

  it('берёт только decision и design — остальные типы не просачиваются', () => {
    const records = [
      rec('D-0001', 'decision', 'approved', ['vue']),
      rec('D-0002', 'design', 'approved', ['vue']),
      rec('R-0001', 'requirement', 'approved', ['vue']),
      rec('T-0001', 'task', 'approved', ['vue'])
    ];
    const got = sharedRecordsOf(records, ['vue']);
    expect(got.map((r) => r.id)).toEqual(['D-0001', 'D-0002']);
  });

  it('берёт только подтверждённое', () => {
    const records = [
      rec('D-0001', 'decision', 'draft', ['vue']),
      rec('D-0002', 'decision', 'approved', ['vue'])
    ];
    expect(sharedRecordsOf(records, ['vue']).map((r) => r.id)).toEqual(['D-0002']);
  });

  it('берёт только с пересечением тегов', () => {
    const records = [
      rec('D-0001', 'decision', 'approved', ['react']),
      rec('D-0002', 'decision', 'approved', ['vue'])
    ];
    expect(sharedRecordsOf(records, ['vue']).map((r) => r.id)).toEqual(['D-0002']);
  });

  it('запись без тегов не подключается никогда, даже если тег выбран', () => {
    const records = [rec('D-0001', 'decision', 'approved', [])];
    expect(sharedRecordsOf(records, ['vue'])).toEqual([]);
  });

  it('одна запись подходит под несколько выбранных тегов — не дублируется', () => {
    const records = [rec('D-0001', 'decision', 'approved', ['vue', 'typescript'])];
    expect(sharedRecordsOf(records, ['vue', 'typescript'])).toHaveLength(1);
  });
});

describe('narrowDomainTypes', () => {
  it('пусто, когда в источнике только decision и design', () => {
    const records = [rec('D-0001', 'decision', 'approved'), rec('D-0002', 'design', 'approved')];
    expect(narrowDomainTypes(records)).toEqual([]);
  });

  it('называет типы узкого домена, без повторов, по алфавиту', () => {
    const records = [
      rec('T-0001', 'task', 'approved'),
      rec('T-0002', 'task', 'approved'),
      rec('R-0001', 'requirement', 'approved'),
      rec('D-0001', 'decision', 'approved')
    ];
    expect(narrowDomainTypes(records)).toEqual(['requirement', 'task']);
  });

  it('отменённую или заменённую запись не считает — источник, который почистили, не должен снова выглядеть грязным', () => {
    const records = [
      rec('R-0001', 'requirement', 'dropped'),
      rec('R-0002', 'requirement', 'superseded'),
      rec('D-0001', 'decision', 'approved')
    ];
    expect(narrowDomainTypes(records)).toEqual([]);
  });
});

describe('availableTagsOf', () => {
  it('собирает теги только с decision/design, только подтверждённых, без повторов, по алфавиту', () => {
    const records = [
      rec('D-0001', 'decision', 'approved', ['vue', 'typescript']),
      rec('D-0002', 'design', 'approved', ['typescript', 'backend']),
      rec('D-0003', 'decision', 'draft', ['not-yet']),
      rec('T-0001', 'task', 'approved', ['not-a-practice'])
    ];
    expect(availableTagsOf(records)).toEqual(['backend', 'typescript', 'vue']);
  });

  it('пусто, когда подключиться нечем', () => {
    expect(availableTagsOf([])).toEqual([]);
  });

  it('видит тег, даже если он ни разу не выбран в подключении, — это и есть список для галочек', () => {
    const records = [rec('D-0001', 'decision', 'approved', ['kotlin', 'android'])];
    expect(availableTagsOf(records)).toEqual(['android', 'kotlin']);
    // Отбор по тегам без выбора — пусто; доступные теги — не то же самое.
    expect(sharedRecordsOf(records, [])).toEqual([]);
  });
});

const LF = String.fromCharCode(10);

function record(id: string, type: string, status: string, title: string, tags: string[]): string {
  return [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: ${title}`,
    `status: ${status}`,
    `created: 2026-09-07`,
    `updated: 2026-09-07`,
    `tags: [${tags.join(', ')}]`,
    '---',
    '',
    `# ${title}`,
    '',
    'Текст.',
    ''
  ].join(LF);
}

/**
 * Источник читается как отдельный, самостоятельно провалидированный корень —
 * не как путь внутри корня проекта, который его подключает (docs/01-architecture.md,
 * «Безопасность»; docs/11-shared-sources.md). Здесь источник живёт в СВОЁМ
 * временном каталоге, а не внутри каталога какого-либо «текущего» проекта —
 * это и есть то, что проверяется.
 */
describe('sharedSourcesOf', () => {
  let source = '';

  beforeAll(() => {
    source = mkdtempSync(join(tmpdir(), 'docdd-shared-source-'));
    mkdirSync(join(source, 'docs', 'development', 'decisions'), { recursive: true });
    mkdirSync(join(source, 'docs', 'development', 'design'), { recursive: true });
    mkdirSync(join(source, 'docs', 'development', 'tasks'), { recursive: true });

    writeFileSync(join(source, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: stack-conventions',
      '  name: Stack Conventions',
      'paths:',
      '  decisions: decisions',
      '  design: design',
      '  tasks: tasks',
      ''
    ].join(LF), 'utf8');

    writeFileSync(
      join(source, 'docs', 'development', 'decisions', 'A-0001-vue.md'),
      record('A-0001', 'decision', 'approved', 'Composition API везде', ['vue']),
      'utf8'
    );
    writeFileSync(
      join(source, 'docs', 'development', 'decisions', 'A-0002-chernovik.md'),
      record('A-0002', 'decision', 'draft', 'Ещё не решили', ['vue']),
      'utf8'
    );
    writeFileSync(
      join(source, 'docs', 'development', 'design', 'D-0001-ts.md'),
      record('D-0001', 'design', 'approved', 'Строгий TypeScript', ['typescript']),
      'utf8'
    );
    writeFileSync(
      join(source, 'docs', 'development', 'tasks', 'T-0001-chuzhaya.md'),
      record('T-0001', 'task', 'backlog', 'Чужая рабочая задача', []),
      'utf8'
    );
  });

  afterAll(() => {
    try {
      rmSync(source, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('читает подтверждённое по выбранному тегу — из своего, отдельного корня', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: ['vue'] }]);
    expect(view?.error).toBeUndefined();
    expect(view?.label).toBe('stack-conventions');
    expect(view?.records.map((r) => r.id)).toEqual(['A-0001']);
  });

  it('доступные теги видны все — включая typescript, которым сейчас не подключено ничего', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: ['vue'] }]);
    expect(view?.availableTags).toEqual(['typescript', 'vue']);
  });

  it('тегов не выбрано — источник назван, но пуст', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: [] }]);
    expect(view?.records).toEqual([]);
    expect(view?.error).toBeUndefined();
  });

  it('видит задачу в источнике и называет её — заметно, не тихо', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: ['vue'] }]);
    expect(view?.narrowDomain).toEqual(['task']);
  });

  it('путь, который не открывается как проект, — ошибка у этого источника, а не крах всего списка', () => {
    const bad = join(source, 'нет-такой-папки');
    const [view] = sharedSourcesOf([{ path: bad, tags: ['vue'] }]);
    expect(view?.error).toBeTruthy();
    expect(view?.records).toEqual([]);
  });

  it('несколько источников — каждый сам по себе', () => {
    const bad = join(source, 'нет-такой-папки');
    const views = sharedSourcesOf([
      { path: source, tags: ['typescript'] },
      { path: bad, tags: [] }
    ]);
    expect(views).toHaveLength(2);
    expect(views[0]?.records.map((r) => r.id)).toEqual(['D-0001']);
    expect(views[1]?.error).toBeTruthy();
  });

  it('источник не зарегистрирован проектом — ссылаться некуда, id пуст', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: ['vue'] }]);
    expect(view?.registeredProjectId).toBeNull();
  });

  it('источник зарегистрирован — виден id, по которому строится ссылка на запись', () => {
    const [view] = sharedSourcesOf(
      [{ path: source, tags: ['vue'] }],
      [{ id: 'stack-conventions', name: 'Stack Conventions', root: source, lastOpenedAt: '2026-09-07T00:00:00.000Z' }]
    );
    expect(view?.registeredProjectId).toBe('stack-conventions');
  });

  it('preview — то же самое, что уйдёт в запрос модели, для тегов этого источника прямо сейчас', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: ['vue'] }]);
    expect(view?.preview).toEqual([
      expect.objectContaining({ label: 'stack-conventions', id: 'A-0001', title: 'Composition API везде' })
    ]);
  });

  it('тегов не выбрано — preview пуст, как и раздел в запросе для этого источника', () => {
    const [view] = sharedSourcesOf([{ path: source, tags: [] }]);
    expect(view?.preview).toEqual([]);
  });
});

describe('toggleSourceTag', () => {
  let consumer = '';

  beforeAll(() => {
    consumer = mkdtempSync(join(tmpdir(), 'docdd-shared-consumer-'));
    mkdirSync(join(consumer, 'docs', 'development'), { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(consumer, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  function manifestWith(sharedBlock: string): string {
    return [
      'contract: docdd.workspace/1',
      'project:',
      '  id: consumer',
      '  name: Consumer',
      'paths:',
      '  requirements: requirements',
      'sources:',
      '  # комментарий человека — должен уцелеть',
      '  inbox: [docs/inbox]',
      '  shared:',
      sharedBlock,
      ''
    ].join(LF);
  }

  const manifestPath = () => join(consumer, 'docs', 'development', 'project.yaml');

  it('включает тег — источник назван, тегов ещё не было', () => {
    writeFileSync(manifestPath(), manifestWith('    - path: /source'), 'utf8');
    const outcome = toggleSourceTag(consumer, '/source', 'vue', true);
    expect(outcome.ok, outcome.ok ? '' : outcome.message).toBe(true);
    const text = readFileSync(manifestPath(), 'utf8');
    expect(text).toContain('tags: [vue]');
    expect(text).toContain('комментарий человека — должен уцелеть');
  });

  it('включает второй тег рядом с уже выбранным', () => {
    writeFileSync(manifestPath(), manifestWith('    - path: /source\n      tags: [vue]'), 'utf8');
    const outcome = toggleSourceTag(consumer, '/source', 'typescript', true);
    expect(outcome.ok).toBe(true);
    expect(readFileSync(manifestPath(), 'utf8')).toContain('tags: [vue, typescript]');
  });

  it('выключает тег, не трогая остальные', () => {
    writeFileSync(manifestPath(), manifestWith('    - path: /source\n      tags: [vue, typescript, backend]'), 'utf8');
    const outcome = toggleSourceTag(consumer, '/source', 'typescript', false);
    expect(outcome.ok).toBe(true);
    expect(readFileSync(manifestPath(), 'utf8')).toContain('tags: [vue, backend]');
  });

  it('источника с таким путём нет — понятный отказ, файл не тронут', () => {
    const before = manifestWith('    - path: /source\n      tags: [vue]');
    writeFileSync(manifestPath(), before, 'utf8');
    const outcome = toggleSourceTag(consumer, '/другой-путь', 'vue', true);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('source_not_found');
    expect(readFileSync(manifestPath(), 'utf8')).toBe(before);
  });
});

describe('connectedPractices', () => {
  let source = '';

  beforeAll(() => {
    source = mkdtempSync(join(tmpdir(), 'docdd-practices-source-'));
    mkdirSync(join(source, 'docs', 'development', 'decisions'), { recursive: true });

    writeFileSync(join(source, 'docs', 'development', 'project.yaml'), [
      'contract: docdd.workspace/1',
      'project:',
      '  id: stack-conventions',
      '  name: Stack Conventions',
      'paths:',
      '  decisions: decisions',
      ''
    ].join(LF), 'utf8');

    writeFileSync(join(source, 'docs', 'development', 'decisions', 'A-0001-vue.md'), [
      '---',
      'id: A-0001',
      'type: decision',
      'title: Composition API везде',
      'status: approved',
      'created: 2026-09-07',
      'updated: 2026-09-07',
      'tags: [vue]',
      '---',
      '',
      '# Composition API везде',
      '',
      'Текст решения — то, что должно попасть в запрос модели.',
      '',
      '## Журнал',
      '',
      '- 2026-09-07 · заведена · architect',
      ''
    ].join(LF), 'utf8');

    writeFileSync(
      join(source, 'docs', 'development', 'decisions', 'A-0002-chernovik.md'),
      record('A-0002', 'decision', 'draft', 'Ещё не решили', ['vue']),
      'utf8'
    );
  });

  afterAll(() => {
    try {
      rmSync(source, { recursive: true, force: true });
    } catch {
      // Прибирать не обязательно.
    }
  });

  it('текст записи доходит без front matter и журнала — это и уходит в запрос модели', () => {
    const practices = connectedPractices([{ path: source, tags: ['vue'] }]);
    expect(practices).toHaveLength(1);
    expect(practices[0]).toMatchObject({ label: 'stack-conventions', id: 'A-0001', title: 'Composition API везде' });
    expect(practices[0]?.body).toContain('Текст решения');
    expect(practices[0]?.body).not.toContain('Журнал');
    expect(practices[0]?.body).not.toContain('id: A-0001');
  });

  it('черновик не подключается — то же правило, что и на экране', () => {
    const practices = connectedPractices([{ path: source, tags: ['vue'] }]);
    expect(practices.map((p) => p.id)).not.toContain('A-0002');
  });

  it('тегов не выбрано — практик нет', () => {
    expect(connectedPractices([{ path: source, tags: [] }])).toEqual([]);
  });

  it('источник не открылся — пропускается, задача всё равно собирается', () => {
    const bad = join(source, 'нет-такой-папки');
    expect(connectedPractices([{ path: bad, tags: ['vue'] }])).toEqual([]);
  });

  it('sources.shared не задан вовсе — пустой список, не ошибка', () => {
    expect(connectedPractices([])).toEqual([]);
  });
});
