// Автопоиск источников и правка манифеста (R-0077, docs/04-ui.md, «Подключение»).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { applySources, detectProjectSources } from '../server/utils/source-scan';
import { ciReportFormat, contractFormat, dependencyFormat, detectSources, mergeSourceList, newFolders } from '../server/lib/source-detect';

const files = (...paths: string[]) => paths;
const many = (dir: string, ext: string, n: number) => Array.from({ length: n }, (_, i) => `${dir}/f${i}.${ext}`);

describe('папки: код, клиент, документация, тесты', () => {
  const found = detectSources([
    ...many('server', 'ts', 5), ...many('app', 'vue', 4), ...many('app', 'ts', 2), ...many('docs', 'md', 3), ...many('tests', 'ts', 6),
    ...many('node_modules/x', 'js', 9), ...many('dist', 'js', 9), 'README.md', 'package.json'
  ]);
  const of = (kind: string) => found.folders.filter((item) => item.kind === kind).map((item) => item.path);
  it('находит каждую роль по составу файлов', () => {
    expect(of('code')).toEqual(['server']);
    expect(of('client')).toEqual(['app']);
    expect(of('docs')).toEqual(['docs']);
    expect(of('tests')).toEqual(['tests']);
  });
  it('сборка и зависимости не источники', () => {
    expect(found.folders.some((item) => item.path === 'node_modules' || item.path === 'dist')).toBe(false);
  });
  it('монорепозиторий: код ищется на уровень глубже', () => {
    const mono = detectSources([...many('packages/api', 'go', 4), ...many('packages/web', 'tsx', 5)]);
    expect(mono.folders.map((item) => `${item.kind}:${item.path}`)).toEqual(['code:packages/api', 'client:packages/web']);
  });
  it('тесты рядом с кодом — своя находка; docs/development не предлагается', () => {
    const near = detectSources([...many('src', 'py', 4), 'src/test_a.py', ...many('docs/development', 'md', 3)]);
    expect(near.folders.find((item) => item.kind === 'tests')?.path).toBe('src');
    expect(near.folders.some((item) => item.path === 'docs/development')).toBe(false);
  });
  it('в пустом проекте находить нечего', () => {
    expect(detectSources([])).toEqual({ folders: [], files: [] });
  });
});

describe('файлы: контракты, зависимости, отчёты CI', () => {
  it('форматы по имени', () => {
    expect(contractFormat('api/openapi.yaml')).toBe('openapi');
    expect(contractFormat('proto/user.proto')).toBe('proto');
    expect(contractFormat('schemas/report.schema.json')).toBe('json-schema');
    expect(contractFormat('src/index.ts')).toBeNull();
    expect(dependencyFormat('package.json')).toBe('npm');
    expect(dependencyFormat('App/App.csproj')).toBe('nuget');
    expect(ciReportFormat('reports/junit.xml')).toBe('junit');
    expect(ciReportFormat('docs/development/tests/reports/x.json')).toBeNull();
  });
  it('зависимости — у корня, а не из вложенных пакетов node_modules', () => {
    const found = detectSources(files('package.json', 'node_modules/a/package.json', 'packages/web/package.json', 'a/b/c/d/package.json'));
    expect(found.files.map((item) => item.path)).toEqual(['package.json', 'packages/web/package.json']);
  });
});

describe('что уже названо', () => {
  it('названное в манифесте не предлагается снова', () => {
    const found = detectSources([...many('server', 'ts', 5), ...many('app', 'vue', 4)]);
    expect(newFolders(found.folders, { code: ['server'] }).map((item) => item.path)).toEqual(['app']);
  });
});

describe('правка sources в манифесте', () => {
  const manifest = ['contract: docdd.workspace/1', 'sources:', '  # код', '  code: []', '  docs: [old]', 'roles:', '  - id: a', ''].join('\n');
  it('объединяет с названным и ничего не убирает', () => {
    const edit = mergeSourceList(manifest, 'docs', ['docs', 'old']);
    expect(edit).toMatchObject({ ok: true, added: ['docs'] });
    if (edit.ok) expect(edit.text).toContain('  docs: [old, docs]');
  });
  it('пустой список заполняется, комментарии остаются', () => {
    const edit = mergeSourceList(manifest, 'code', ['server', 'cli']);
    expect(edit.ok && edit.text).toContain('  code: [server, cli]');
    expect(edit.ok && edit.text).toContain('  # код');
  });
  it('нет ключа — вставляется под sources', () => {
    const edit = mergeSourceList(manifest, 'tests', ['tests']);
    expect(edit.ok && edit.text.split('\n').slice(0, 3)).toEqual(['contract: docdd.workspace/1', 'sources:', '  tests: [tests]']);
  });
  it('нечего добавить — текст не меняется; нет секции или блочный список — отказ словами', () => {
    expect(mergeSourceList(manifest, 'docs', ['old'])).toEqual({ ok: true, text: manifest, added: [] });
    expect(mergeSourceList('contract: x\n', 'code', ['a'])).toMatchObject({ ok: false });
    expect(mergeSourceList('sources:\n  code:\n    - a\n', 'code', ['b'])).toMatchObject({ ok: false });
  });
  it('перевод строки CRLF сохраняется', () => {
    const edit = mergeSourceList(manifest.replace(/\n/g, '\r\n'), 'code', ['server']);
    expect(edit.ok && edit.text.includes('\r\n')).toBe(true);
    expect(edit.ok && /[^\r]\n/.test(edit.text)).toBe(false);
  });
});

describe('запись в манифест настоящего проекта', () => {
  const project = () => {
    const root = mkdtempSync(join(tmpdir(), 'docdd-src-'));
    mkdirSync(join(root, 'docs', 'development'), { recursive: true });
    for (const dir of ['server', 'docs/guide']) mkdirSync(join(root, dir), { recursive: true });
    for (let i = 0; i < 4; i += 1) writeFileSync(join(root, 'server', `m${i}.ts`), 'export {}');
    for (let i = 0; i < 3; i += 1) writeFileSync(join(root, 'docs', 'guide', `g${i}.md`), '# g');
    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  requirements: requirements', 'sources:', '  code: []', '  docs: []', ''].join('\n'));
    return root;
  };
  it('находит источники без ручной правки манифеста и записывает подтверждённое', () => {
    const root = project();
    try {
      const report = detectProjectSources(root);
      expect(report.fresh.map((item) => `${item.kind}:${item.path}`)).toEqual(expect.arrayContaining(['code:server', 'docs:docs']));
      const outcome = applySources(root, [{ kind: 'code', path: 'server' }, { kind: 'docs', path: 'docs' }]);
      expect(outcome).toEqual({ ok: true, added: { code: ['server'], docs: ['docs'] } });
      const text = readFileSync(join(root, 'docs', 'development', 'project.yaml'), 'utf8');
      expect(text).toContain('  code: [server]');
      expect(text).toContain('  docs: [docs]');
      // Повтор ничего не меняет.
      expect(applySources(root, [{ kind: 'code', path: 'server' }])).toEqual({ ok: true, added: {} });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('папка, которой нет, — отказ; выход за корень — исключение', () => {
    const root = project();
    try {
      expect(applySources(root, [{ kind: 'code', path: 'nope' }])).toMatchObject({ ok: false, code: 'path_not_found' });
      expect(() => applySources(root, [{ kind: 'code', path: '../outside' }])).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
