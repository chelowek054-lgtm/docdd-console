import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseProposal, resolveLinks } from '../server/lib/inbox';
import { acceptNotes } from '../server/utils/inbox-service';
import { generalReferenceEntries } from '../server/utils/rules-service';
import { architecturePrompt, inboxPrompt, REFERENCE_MARKER, taskPrompt } from '../server/lib/prompt';

import { buildReferenceIndex, INDEX_LINE_LIMIT, sameIndex, type ReferenceEntry } from '../server/lib/reference';
import { referenceEntries, referenceRules, taskReuseUnchecked } from '../server/lib/rules';
import { validateFrontMatter } from '../server/lib/schema';
import { recordTemplate } from '../server/lib/scaffold';
import { referenceChoices, withReuses } from '../server/lib/task-order';
import { codes, context, rec } from './helpers';

/** Справочник (docs/13-reference.md, ADR-0016): тип reference, индекс, предупреждения. */

const entry = (patch: Partial<ReferenceEntry> = {}): ReferenceEntry => ({
  id: 'S-0001', title: 'RouterAI Jev', summary: 'модель решений вместо текста', kind: 'api', fetched: '2026-10-07',
  path: 'docs/development/reference/S-0001-jev.md', ...patch
});

const modules = [
  { id: 'server/lib/glob.ts', path: 'server/lib/glob.ts', summary: 'пути правил: * и **' },
  { id: 'server/lib/inner.ts', path: 'server/lib/inner.ts', summary: 'внутренность группы' },
  { id: 'app/page.vue', path: 'app/page.vue' }
];
const evidence = { path: 'app/page.vue', line: 1, fragment: 'import' };
const imports = [{ from: 'app/page.vue', to: 'server/lib/glob.ts', evidence }];
const groups = [
  { id: 'lib', title: 'Библиотека', paths: ['server/lib'], summary: 'чистые функции' },
  { id: 'ui', title: 'Экраны', paths: ['app'] }
];

describe('индекс справочника', () => {
  it('три раздела; модули — порты групп с описанием, справки по виду', () => {
    const index = buildReferenceIndex({
      references: [entry(), entry({ id: 'S-0002', title: 'Flex', summary: '−50% цены', kind: 'technique' })],
      modules, imports, groups
    });
    expect(index.text).toContain('## Модули проекта');
    expect(index.text).toContain('### Библиотека — чистые функции');
    expect(index.text).toContain('- `server/lib/glob.ts` — пути правил: * и **');
    expect(index.text).not.toContain('server/lib/inner.ts');
    expect(index.text).toContain('## Внешние решения\n- **RouterAI Jev** (S-0001, api, 2026-10-07) — модель решений вместо текста → docs/development/reference/S-0001-jev.md');
    expect(index.text).toContain('## Приёмы и данные\n- **Flex** (S-0002, technique, 2026-10-07)');
    expect(index.lines).toBe(3);
  });

  it('порт без описания — «описания нет» и счётчик', () => {
    const index = buildReferenceIndex({
      references: [], modules: [{ id: 'server/lib/glob.ts', path: 'server/lib/glob.ts' }, modules[2] as never], imports, groups
    });
    expect(index.text).toContain('- `server/lib/glob.ts` — описания нет');
    expect(index.undescribedModules).toBe(1);
  });

  it('справка из источника — с меткой; пусто — «Пока ничего»', () => {
    expect(buildReferenceIndex({ references: [entry({ label: 'docdd' })], modules: [], imports: [] }).text).toContain('(docdd] S-0001'.replace('(docdd]', '([docdd]'));
    const empty = buildReferenceIndex({ references: [], modules: [], imports: [] });
    expect(empty.text).toContain('Пока ничего: карта кода не описана или не подтверждена.');
    expect(empty.text).toContain('## Внешние решения\nПока ничего.');
  });

  it('детерминирован и не больше предела строк; остаток — «и ещё N»', () => {
    const many = Array.from({ length: 400 }, (_, at) => entry({ id: `S-${String(at + 1).padStart(4, '0')}`, title: `Справка ${at}` }));
    const first = buildReferenceIndex({ references: many, modules: [], imports: [] });
    expect(buildReferenceIndex({ references: [...many].reverse(), modules: [], imports: [] }).text).toBe(first.text);
    const bulkModules = Array.from({ length: 500 }, (_, at) => ({ id: `lib/m${at}.ts`, path: `lib/m${at}.ts`, summary: 'модуль' }));
    const bulkImports = bulkModules.map((module) => ({ from: `app/u${module.id}`, to: module.id, evidence }));
    const capped = buildReferenceIndex({ references: [], modules: bulkModules, imports: bulkImports, groups: [{ id: 'l', title: 'L', paths: ['lib'] }] });
    expect(capped.lines).toBeLessThanOrEqual(INDEX_LINE_LIMIT);
    expect(capped.text).toContain('…и ещё');
  });

  it('сравнение не замечает перевод строк и хвост', () => {
    expect(sameIndex('a\r\nb\r\n', 'a\nb')).toBe(true);
    expect(sameIndex(null, 'a')).toBe(false);
    expect(sameIndex('a', 'b')).toBe(false);
  });
});

describe('справка: запись и схема', () => {
  it('шаблон несёт summary, kind, source, fetched и проходит схему', () => {
    const text = recordTemplate({ id: 'S-0001', type: 'reference', title: 'Jev', today: '2026-10-07', summary: 'решения вместо текста', kind: 'api', source: 'RouterAI' });
    expect(text).toContain('summary: решения вместо текста');
    expect(text).toContain('kind: api');
    expect(text).toContain('fetched: 2026-10-07');
    expect(text).toContain('Что это, когда брать');
  });

  it('схема: summary обязателен, kind из списка, связь reuses и reuse: none допустимы', () => {
    const base = { id: 'S-0001', type: 'reference', title: 'x', status: 'draft', created: '2026-10-07', updated: '2026-10-07' };
    expect(validateFrontMatter({ ...base, summary: 'ok', kind: 'api' })).toEqual([]);
    expect(validateFrontMatter(base)).not.toEqual([]);
    expect(validateFrontMatter({ ...base, summary: 'ok', kind: 'wizard' })).not.toEqual([]);
    const task = { id: 'T-0001', type: 'task', title: 't', status: 'backlog', created: '2026-10-07', updated: '2026-10-07', change: 'feature' };
    expect(validateFrontMatter({ ...task, links: { reuses: ['S-0001'] } })).toEqual([]);
    expect(validateFrontMatter({ ...task, links: {}, reuse: 'none' })).toEqual([]);
    expect(validateFrontMatter({ ...task, links: {}, reuse: 'maybe' })).not.toEqual([]);
  });
});

describe('предупреждения справочника', () => {
  const reference = { path: 'docs/development/reference/INDEX.md', staleDays: 180 };
  const approved = (id: string, extra: Record<string, unknown>) => rec(id, 'reference', 'approved', { extra: { kind: 'api', ...extra } });

  it('нет paths.reference — справочника нет, проверок нет', () => {
    const ctx = context([rec('S-0001', 'reference', 'approved', {})]);
    expect(referenceRules(ctx)).toEqual([]);
    const task = rec('T-0001', 'task', 'ready', { extra: { change: 'feature' } });
    expect(taskReuseUnchecked(context([task]))).toEqual([]);
  });

  it('reference_no_summary и reference_stale', () => {
    const ctx = {
      ...context([approved('S-0001', { fetched: '2026-10-01' }), approved('S-0002', { summary: 'ok', fetched: '2025-01-01' })], { now: '2026-10-07' }),
      reference
    };
    const found = referenceRules(ctx).filter((item) => item.code !== 'reference_index_stale');
    expect(codes(found)).toEqual(['reference_no_summary', 'reference_stale']);
    expect(found.find((item) => item.code === 'reference_stale')?.id).toBe('S-0002');
  });

  it('индекс расходится с файлом — reference_index_stale; совпадает — тишина', () => {
    const records = [approved('S-0001', { summary: 'решения', fetched: '2026-10-07' })];
    const expected = buildReferenceIndex({ references: referenceEntries(records), modules: [], imports: [] }).text;
    const fresh = { ...context(records, { sources: { [reference.path]: expected } }), reference };
    expect(referenceRules(fresh)).toEqual([]);
    const stale = { ...context(records, { sources: { [reference.path]: 'устарел' } }), reference };
    expect(codes(referenceRules(stale))).toEqual(['reference_index_stale']);
    expect(codes(referenceRules({ ...context(records), reference }))).toEqual(['reference_index_stale']);
  });

  it('task_reuse_unchecked: feature с ready и дальше без reuses и без reuse: none', () => {
    const feature = (id: string, status: string, extra: Record<string, unknown> = {}, links = {}) =>
      rec(id, 'task', status, { extra: { change: 'feature', ...extra }, links });
    const ctx = {
      ...context([
        feature('T-0001', 'ready'),
        feature('T-0002', 'ready', {}, { reuses: ['S-0001'] }),
        feature('T-0003', 'ready', { reuse: 'none' }),
        feature('T-0004', 'backlog'),
        rec('T-0005', 'task', 'ready', { extra: { change: 'fix' } })
      ]),
      reference
    };
    expect(taskReuseUnchecked(ctx).map((item) => item.id)).toEqual(['T-0001']);
  });
});

describe('индекс в запросах модели', () => {
  const index = buildReferenceIndex({ references: [entry()], modules: [], imports: [] }).text;
  const base = { id: 'T-0001', title: 'Задача', body: 'Сделать.', requirements: [], documents: [], map: '', modules: [], practices: [], rework: '', round: 1 };

  it('запрос на выполнение: индекс без пометки «сгенерировано», правило «не писать заново», справки задачи текстом', () => {
    const text = taskPrompt('# З\n\n---\n\n<!-- ЗАДАЧА -->\n', {
      ...base, referenceIndex: index, reused: [{ id: 'S-0001', title: 'RouterAI Jev', body: 'POST /api/v1/decisions' }]
    });
    expect(text).toContain('## Справочник: что уже есть');
    expect(text).toContain('найди в этом индексе, что уже решает то же самое');
    expect(text).toContain('- **RouterAI Jev** (S-0001, api, 2026-10-07)');
    expect(text).not.toContain('Сгенерировано приложением');
    expect(text).not.toContain('\n# Справочник проекта');
    expect(text).toContain('### Справка S-0001: RouterAI Jev (задача её переиспользует)');
    expect(text).toContain('POST /api/v1/decisions');
  });

  it('справочника нет и справок у задачи нет — раздела в запросе нет', () => {
    expect(taskPrompt('# З\n\n---\n\n<!-- ЗАДАЧА -->\n', { ...base, referenceIndex: null })).not.toContain('Справочник');
  });

  it('разбор входящего и аудит подставляют индекс; без него говорят прямо', () => {
    const inbox = inboxPrompt('# З\n\n---\n\n<!-- СПРАВОЧНИК -->\n', [], [], [], index);
    expect(inbox).toContain('RouterAI Jev');
    expect(inboxPrompt('# З\n\n---\n\n<!-- СПРАВОЧНИК -->\n', [], [], [], null)).toContain('Справочника в проекте пока нет');
    const audit = architecturePrompt('# З\n\n---\n\n<!-- СПРАВОЧНИК -->\n', { rules: {}, modules: [], found: [], referenceIndex: index });
    expect(audit).toContain('RouterAI Jev');
  });

  it('настоящие шаблоны содержат место для индекса', () => {
    for (const name of ['inbox-plan.md', 'architecture-audit.md']) {
      expect(readFileSync(new URL(`../docs/prompts/${name}`, import.meta.url), 'utf8')).toContain(REFERENCE_MARKER);
    }
  });
});

describe('справка в карточке задачи', () => {
  const records = [
    { id: 'S-0002', type: 'reference', title: 'Flex', status: 'approved', extra: { summary: 'дешевле на 50%' } },
    { id: 'S-0001', type: 'reference', title: 'RouterAI', status: 'approved', extra: { summary: 'шлюз LLM' } },
    { id: 'S-0003', type: 'reference', title: 'Черновик', status: 'draft', extra: {} },
    { id: 'R-0001', type: 'requirement', title: 'RouterAI в требовании', status: 'approved', extra: {} }
  ];

  it('предлагаются только подтверждённые справки; поиск и по строке «что решает»', () => {
    expect(referenceChoices(records, '').map((item) => item.id)).toEqual(['S-0001', 'S-0002']);
    expect(referenceChoices(records, '50%').map((item) => item.id)).toEqual(['S-0002']);
    expect(referenceChoices(records, 'router').map((item) => item.id)).toEqual(['S-0001']);
  });

  it('связи с новой справкой: прежние уходят вместе, повтор не задваивается', () => {
    expect(withReuses({ affects: ['M-0001'] }, 'S-0001')).toEqual({ affects: ['M-0001'], reuses: ['S-0001'] });
    expect(withReuses({ reuses: ['S-0001'] }, 'S-0001').reuses).toEqual(['S-0001']);
    expect(withReuses({ reuses: ['S-0001'] }, 'S-0002').reuses).toEqual(['S-0001', 'S-0002']);
  });
});

describe('справка из входящего', () => {
  const FENCE = String.fromCharCode(96).repeat(3);
  const answer = (value: unknown) => [FENCE + 'docdd-records', JSON.stringify(value), FENCE].join(String.fromCharCode(10));

  it('справка с summary и kind разбирается; skipped приходит рядом', () => {
    const parsed = parseProposal(answer({
      records: [{ key: 'jev', type: 'reference', title: 'Jev', summary: 'решения вместо текста', kind: 'api', source: 'RouterAI', fetched: '2026-10-07', notes: ['docs/inbox/a.md'] }],
      skipped: [{ note: 'docs/inbox/b.md', why: 'черновик без содержания' }]
    }));
    expect(parsed.problems).toEqual([]);
    expect(parsed.records[0]?.summary).toBe('решения вместо текста');
    expect(parsed.skipped).toEqual([{ note: 'docs/inbox/b.md', why: 'черновик без содержания' }]);
  });

  it('справка без summary и вид не из списка не проходят схему', () => {
    expect(parseProposal(answer({ records: [{ key: 'x', type: 'reference', title: 'X' }] })).problems).not.toEqual([]);
    expect(parseProposal(answer({ records: [{ key: 'x', type: 'reference', title: 'X', summary: 's', kind: 'wizard' }] })).problems).not.toEqual([]);
  });

  it('пустой список с skipped — ответ, а не сбой; skipped без причины — нет', () => {
    const empty = parseProposal(answer({ records: [], skipped: [{ note: 'docs/inbox/b.md', why: 'нечего' }] }));
    expect(empty.records).toEqual([]);
    expect(empty.problems).toEqual([]);
    expect(parseProposal(answer({ records: [], skipped: [{ note: 'docs/inbox/b.md' }] })).problems).not.toEqual([]);
  });

  it('задача с reuse: none попадает в файл строкой reuse', () => {
    const text = recordTemplate({ id: 'T-0001', type: 'task', title: 'T', today: '2026-10-07', change: 'feature', reuse: 'none' });
    expect(text).toContain('reuse: none');
  });

  it('связь reuses на справку S-… разрешается как уже заведённая', () => {
    const resolved = resolveLinks({ reuses: ['S-0003'] }, new Map());
    expect(resolved.links).toEqual({ reuses: ['S-0003'] });
    expect(resolved.problems).toEqual([]);
  });
});

describe('принять заметки без записей', () => {
  it('заметка из входящего переезжает в принятое; чужая — претензия', () => {
    const dir = mkdtempSync(join(tmpdir(), 'docdd-accept-'));
    try {
      mkdirSync(join(dir, 'docs/development'), { recursive: true });
      mkdirSync(join(dir, 'docs/inbox'), { recursive: true });
      writeFileSync(join(dir, 'docs/development/project.yaml'), 'contract: docdd.workspace/1\nproject:\n  id: t\n  name: T\npaths: {}\nsources:\n  inbox: [docs/inbox]\n');
      writeFileSync(join(dir, 'docs/inbox/a.md'), '# Справка\n\nФакты.\n');
      const result = acceptNotes(dir, ['docs/inbox/a.md', 'docs/inbox/нет.md']);
      expect(result.accepted).toEqual(['docs/inbox/a.md']);
      expect(result.problems).toHaveLength(1);
      expect(existsSync(join(dir, 'docs/inbox/a.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/inbox/принятое/a.md'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('справки из подключённых источников', () => {
  it('подтверждённые справки с подключённым тегом идут с меткой источника и абсолютным путём', () => {
    const dir = mkdtempSync(join(tmpdir(), 'docdd-refsrc-'));
    try {
      mkdirSync(join(dir, 'docs/development/reference'), { recursive: true });
      writeFileSync(join(dir, 'docs/development/project.yaml'), 'contract: docdd.workspace/1\nproject:\n  id: refsrc\n  name: Источник\npaths:\n  reference: reference\n');
      const note = (id: string, status: string, tags: string) => [
        '---', `id: ${id}`, 'type: reference', `title: ${id}`, `status: ${status}`, 'summary: что решает', 'kind: component',
        'fetched: 2026-10-07', `tags: ${tags}`, 'created: 2026-10-07', 'updated: 2026-10-07', '---', '', `# ${id}`, '', '## Журнал', ''
      ].join('\n');
      writeFileSync(join(dir, 'docs/development/reference/S-0001-a.md'), note('S-0001', 'approved', '[diagrams]'));
      writeFileSync(join(dir, 'docs/development/reference/S-0002-b.md'), note('S-0002', 'draft', '[diagrams]'));
      writeFileSync(join(dir, 'docs/development/reference/S-0003-c.md'), note('S-0003', 'approved', '[other]'));

      const found = generalReferenceEntries([{ path: dir, tags: ['diagrams'] }]);
      expect(found.map((item) => item.id)).toEqual(['S-0001']);
      expect(found[0]?.label).toBe('refsrc');
      expect(found[0]?.path).toContain('/docs/development/reference/S-0001-a.md');
      expect(generalReferenceEntries([{ path: dir, tags: [] }])).toEqual([]);
      expect(generalReferenceEntries([{ path: join(dir, 'нет') }])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
