// Контракты, справки и глоссарий из кода и документации (R-0080, docs/04-ui.md, «Подключение»).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REFERENCE_LIMIT, contractRecords, mergeGlossary, parseContract, parseDependencies, referenceRecords, referencedPaths, termsFromDocs } from '../server/lib/contracts-import';
import { manifestYaml } from '../server/lib/scaffold';
import { importContracts, importGlossary, importReferences } from '../server/utils/contracts-service';
import { collectOnboarding } from '../server/utils/onboarding-service';
import type { FileFinding } from '../server/lib/source-detect';

const OPENAPI = 'openapi: 3.0.0\ninfo:\n  title: Платёжный API\n  version: 1.2.0\npaths:\n  /pay:\n    post: {}\n    get: {}\n  /refund:\n    post: {}\n';
const PROTO = 'syntax = "proto3";\npackage shop.v1;\nservice Cart {\n  rpc Add (AddReq) returns (AddRes);\n  rpc Drop (DropReq) returns (DropRes);\n}\nmessage AddReq {}\nmessage AddRes {}\nmessage DropReq {}\nmessage DropRes {}\n';
const SCHEMA = JSON.stringify({ title: 'Отчёт прогона', description: 'Формат отчёта. Подробности ниже.', properties: { a: {}, b: {} } });

describe('контракты по формату файла', () => {
  it('OpenAPI (YAML и JSON): название, версия, число путей и операций', () => {
    expect(parseContract('openapi', 'api/openapi.yaml', OPENAPI)).toEqual({ title: 'Платёжный API', summary: 'HTTP API, версия 1.2.0: 2 путей, 3 операций' });
    expect(parseContract('openapi', 'openapi.json', JSON.stringify({ info: { title: 'X' }, paths: { '/a': { get: {} } } }))?.summary).toContain('1 путей, 1 операций');
  });
  it('proto: пакет, сервисы, вызовы, сообщения', () => {
    expect(parseContract('proto', 'cart.proto', PROTO)).toEqual({ title: 'shop.v1', summary: 'protobuf: сервисов 1 (Cart), вызовов 2, сообщений 4' });
  });
  it('JSON-схема: название и первая фраза описания', () => {
    expect(parseContract('json-schema', 'report.schema.json', SCHEMA)).toEqual({ title: 'Отчёт прогона', summary: 'JSON-схема: полей верхнего уровня 2 — Формат отчёта' });
  });
  it('нечитаемое — null, а не выдумка', () => {
    expect(parseContract('openapi', 'a.json', '{ сломано')).toBeNull();
    expect(parseContract('неизвестно', 'a.x', '')).toBeNull();
  });
});

describe('записи-контракты', () => {
  const files: FileFinding[] = [{ kind: 'contract', path: 'api/openapi.yaml', format: 'openapi' }, { kind: 'contract', path: 'bad.schema.json', format: 'json-schema' }, { kind: 'dependencies', path: 'package.json', format: 'npm' }];
  const read = (path: string) => ({ 'api/openapi.yaml': OPENAPI, 'bad.schema.json': '{ нет' } as Record<string, string>)[path] ?? null;
  it('черновик со ссылкой на файл в теле и пометкой «подтвердите»; нечитаемый называется', () => {
    const { records, skipped } = contractRecords(files, read, new Set());
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ type: 'contract', title: 'Контракт: Платёжный API' });
    expect(records[0]!.body).toContain('Источник: `api/openapi.yaml` (openapi)');
    expect(skipped).toEqual(['bad.schema.json']);
  });
  it('уже заведённое по пути не повторяется', () => {
    const already = referencedPaths([{ type: 'contract', body: 'Источник: `api/openapi.yaml` (openapi).' }, { type: 'design', body: '`x.yaml`' }]);
    expect([...already]).toEqual(['api/openapi.yaml']);
    expect(contractRecords(files, read, already).records).toEqual([]);
  });
});

describe('зависимости разных форматов', () => {
  it('npm: только прямые, без dev', () => {
    expect(parseDependencies('npm', JSON.stringify({ dependencies: { nuxt: '^4', h3: '1.0' }, devDependencies: { vitest: '2' } }))).toEqual([{ name: 'nuxt', version: '^4' }, { name: 'h3', version: '1.0' }]);
  });
  it('pip: имя и версия, комментарии и флаги пропускаются, повтор — один раз', () => {
    expect(parseDependencies('pip', '# deps\nrequests==2.31\n-r other.txt\nflask>=2\nRequests\n')).toEqual([{ name: 'requests', version: '2.31' }, { name: 'flask', version: '2' }]);
  });
  it('pyproject, go.mod, Cargo.toml, composer', () => {
    expect(parseDependencies('python', '[project]\ndependencies = [\n  "httpx>=0.27",\n  "pydantic"\n]\n').map((d) => d.name)).toEqual(['httpx', 'pydantic']);
    expect(parseDependencies('go', 'module x\nrequire (\n  github.com/a/b v1.2.3\n  github.com/c/d v0.1.0 // indirect\n)\n').map((d) => d.name)).toEqual(['github.com/a/b']);
    expect(parseDependencies('cargo', '[package]\nname="x"\n[dependencies]\nserde = "1"\ntokio = { version = "1.2", features = ["full"] }\n[dev-dependencies]\nfoo = "1"\n').map((d) => d.name)).toEqual(['serde', 'tokio']);
    expect(parseDependencies('composer', JSON.stringify({ require: { php: '^8', 'ext-json': '*', 'monolog/monolog': '3' } })).map((d) => d.name)).toEqual(['monolog/monolog']);
  });
  it('битый файл — пусто', () => {
    expect(parseDependencies('npm', '{ нет')).toEqual([]);
  });
});

describe('справки из зависимостей', () => {
  const file: FileFinding = { kind: 'dependencies', path: 'package.json', format: 'npm' };
  it('черновик с источником, датой и честным «назначение не описано»; заведённые по названию пропускаются', () => {
    const { records, left } = referenceRecords(file, [{ name: 'nuxt', version: '^4' }, { name: 'h3', version: '1' }], new Set(['h3']), '2026-10-22');
    expect(left).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ type: 'reference', title: 'nuxt', kind: 'component', source: 'package.json (npm)', fetched: '2026-10-22' });
    expect(records[0]!.summary).toContain('назначение не описано');
  });
  it('сотня зависимостей — не больше предела за заход, остальное считается', () => {
    const many = Array.from({ length: REFERENCE_LIMIT + 7 }, (_, i) => ({ name: `lib${i}`, version: '1' }));
    const out = referenceRecords(file, many, new Set(), '2026-10-22');
    expect(out.records).toHaveLength(REFERENCE_LIMIT);
    expect(out.left).toBe(7);
  });
});

describe('глоссарий из документации', () => {
  const docs = [{ path: 'docs/a.md', text: '- **Задача** — единица работы в проекте\n**Фаза** — группа задач с общей целью\nпросто текст' }, { path: 'README.md', text: '**Задача** — повтор из другого файла\n**Коротко** — мало' }];
  it('термины со строкой «**Термин** — определение», повтор — первый, слишком короткое определение — нет', () => {
    expect(termsFromDocs(docs)).toEqual([
      { term: 'Задача', definition: 'единица работы в проекте', source: 'docs/a.md' },
      { term: 'Фаза', definition: 'группа задач с общей целью', source: 'docs/a.md' }
    ]);
  });
  it('новый файл — с заголовком и разделом «Из документации», у каждой строки источник', () => {
    const { text, added } = mergeGlossary(null, termsFromDocs(docs), 'Демо');
    expect(added).toBe(2);
    expect(text).toContain('# Глоссарий проекта «Демо»');
    expect(text).toContain('## Из документации (проверьте)');
    expect(text).toContain('- **Задача** — единица работы в проекте. (из `docs/a.md`)');
  });
  it('существующие термины не трогаются и не задваиваются; повтор разделом не плодится; нечего добавлять — текст прежний', () => {
    const first = mergeGlossary('# Глоссарий\n\n- **Задача** — моё определение\n', termsFromDocs(docs), 'Демо');
    expect(first.added).toBe(1);
    expect(first.text).toContain('- **Задача** — моё определение');
    expect(first.text).not.toContain('единица работы в проекте');
    const second = mergeGlossary(first.text, termsFromDocs(docs), 'Демо');
    expect(second).toEqual({ text: first.text, added: 0 });
    const more = mergeGlossary(first.text, [{ term: 'Релиз', definition: 'версия для пользователей', source: 'docs/b.md' }], 'Демо');
    expect(more.text.match(/## Из документации/g)).toHaveLength(1);
  });
});

describe('на настоящем проекте: шаги подключения заводят черновики с источником', () => {
  it('контракты, справки и глоссарий появляются шагом, повтор ничего не задваивает', () => {
    const root = mkdtempSync(join(tmpdir(), 'docdd-ci-'));
    try {
      mkdirSync(join(root, 'docs', 'development'), { recursive: true });
      mkdirSync(join(root, 'api'), { recursive: true });
      mkdirSync(join(root, 'docs', 'guide'), { recursive: true });
      writeFileSync(join(root, 'docs', 'development', 'project.yaml'), manifestYaml({ id: 'ci', name: 'Ci' }).replace('  docs: []', '  docs: [docs]'), 'utf8');
      writeFileSync(join(root, 'api', 'openapi.yaml'), OPENAPI, 'utf8');
      writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { nuxt: '^4', h3: '1' } }), 'utf8');
      writeFileSync(join(root, 'docs', 'guide', 'terms.md'), '**Задача** — единица работы в проекте\n', 'utf8');

      expect(importContracts(root)).toMatchObject({ ok: true, created: 1 });
      expect(importReferences(root)).toMatchObject({ ok: true, created: 2 });
      expect(importGlossary(root)).toMatchObject({ ok: true, created: 1 });

      const dev = join(root, 'docs', 'development');
      const contract = readdirSync(join(dev, 'contracts'))[0]!;
      expect(readFileSync(join(dev, 'contracts', contract), 'utf8')).toContain('Источник: `api/openapi.yaml` (openapi)');
      expect(readdirSync(join(dev, 'reference')).filter((name) => name.startsWith('S-'))).toHaveLength(2);
      expect(readFileSync(join(dev, 'glossary.md'), 'utf8')).toContain('(из `docs/guide/terms.md`)');

      const state = collectOnboarding(root);
      expect(state).toMatchObject({ contractsDraft: 1, referencesDraft: 2, glossaryTerms: 1 });

      expect(importContracts(root)).toMatchObject({ ok: true, created: 0 });
      expect(importReferences(root)).toMatchObject({ ok: true, created: 0 });
      expect(importGlossary(root)).toMatchObject({ ok: true, created: 0 });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
