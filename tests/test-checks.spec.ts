// Проверки из существующих тестов и отчёт сборки (R-0079, docs/04-ui.md, «Подключение»).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { manifestYaml } from '../server/lib/scaffold';
import { createRecords } from '../server/utils/inbox-service';
import { connectReport, createTestChecks, scanTests } from '../server/utils/test-checks-service';
import { commandFor, coverageOf, coveredFiles, findTests, jsRunner, matchTests, parseJunit, parseJsonReport, parseTestReport, pathWords, proposeChecks, requirementIds, verificationsFromReport } from '../server/lib/test-checks';

const pkg = { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^2' } };

describe('поиск тестов и команда запуска', () => {
  const paths = ['src/a.ts', 'tests/auth-login.spec.ts', 'tests/integration/pay.test.ts', 'svc/test_orders.py', 'pkg/cart_test.go', 'README.md'];
  it('находит файлы тестов всех распространённых видов, остальное пропускает', () => {
    expect(findTests(paths, pkg).map((t) => t.path)).toEqual(['pkg/cart_test.go', 'svc/test_orders.py', 'tests/auth-login.spec.ts', 'tests/integration/pay.test.ts']);
  });
  it('раннер — по package.json и по расширению; команда — запуск одного файла', () => {
    expect(jsRunner(pkg)).toBe('vitest');
    expect(jsRunner({ devDependencies: { jest: '1' } })).toBe('jest');
    expect(jsRunner(null)).toBe('unknown');
    const found = Object.fromEntries(findTests(paths, pkg).map((t) => [t.path, t.command]));
    expect(found['tests/auth-login.spec.ts']).toBe('npm run test -- tests/auth-login.spec.ts');
    expect(found['svc/test_orders.py']).toBe('pytest svc/test_orders.py');
    expect(found['pkg/cart_test.go']).toBe('go test ./pkg');
    expect(commandFor('a.spec.ts', 'jest', false)).toBe('npx jest a.spec.ts');
  });
  it('интеграционный тест отличается по пути', () => {
    expect(Object.fromEntries(findTests(paths, pkg).map((t) => [t.path, t.kind]))).toMatchObject({ 'tests/integration/pay.test.ts': 'integration', 'tests/auth-login.spec.ts': 'unit' });
  });
});

describe('сопоставление с требованиями', () => {
  const requirements = [
    { id: 'R-0013', title: 'Доска задач и дорожная карта' },
    { id: 'R-0020', title: 'Login by password and session cookie' },
    { id: 'R-0021', title: 'Login history screen' }
  ];
  const tests = findTests(['tests/r0013-board.spec.ts', 'tests/password-session.spec.ts', 'tests/login.spec.ts', 'tests/zzz.spec.ts'], pkg);
  const matches = matchTests(tests, requirements, (path) => (path.endsWith('zzz.spec.ts') ? '// проверяет R-0021' : ''));
  const of = (path: string) => matches.find((m) => m.test.path === path)!;
  it('номер в имени или в начале файла — явное указание', () => {
    expect(of('tests/r0013-board.spec.ts').requirement?.id).toBe('R-0013');
    expect(of('tests/zzz.spec.ts')).toMatchObject({ requirement: { id: 'R-0021' }, why: expect.stringContaining('номер') });
  });
  it('слова пути в заголовке требования — когда совпадений не меньше двух и однозначно', () => {
    expect(of('tests/password-session.spec.ts')).toMatchObject({ requirement: { id: 'R-0020' }, why: expect.stringContaining('password') });
  });
  it('неоднозначное и случайное не угадываем', () => {
    expect(of('tests/login.spec.ts').requirement).toBeNull();
  });
  it('номера и слова пути', () => {
    // В порядке появления; «R-13» — слишком коротко, чтобы быть номером, повтор не задваивается.
    expect(requirementIds('see R-13 and r0020, R_0021 and R-0013, r0020')).toEqual(['R-0020', 'R-0021', 'R-0013']);
    expect(pathWords('tests/AuthLogin.spec.ts')).toEqual(['auth', 'login']);
  });
});

describe('предложения проверок', () => {
  const requirements = [{ id: 'R-0013', title: 'Доска задач' }];
  const matches = matchTests(findTests(['tests/r0013-board.spec.ts', 'tests/other.spec.ts'], pkg), requirements);
  it('черновик с командой и связью; тест без требования проверкой не становится', () => {
    const proposed = proposeChecks(matches, new Set());
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({ type: 'verification', kind: 'unit', links: { verifies: ['R-0013'] } });
    expect(proposed[0]!.body).toContain('Запуск: `npm run test -- tests/r0013-board.spec.ts`');
  });
  it('уже заведённое не предлагается снова: файл виден и в command, и в строке «Запуск»', () => {
    const covered = coveredFiles([{ body: 'Запуск: `npm run test -- tests/r0013-board.spec.ts`.' }, { command: 'pytest svc/test_orders.py' }]);
    expect([...covered].sort()).toEqual(['svc/test_orders.py', 'tests/r0013-board.spec.ts']);
    expect(proposeChecks(matches, covered)).toEqual([]);
  });
  it('покрытие: какие требования покрыты проверкой', () => {
    const coverage = coverageOf([{ id: 'R-1', title: 'a' }, { id: 'R-2', title: 'b' }], [{ links: { verifies: ['R-1'] } }]);
    expect(coverage).toMatchObject({ percent: 50, covered: [{ id: 'R-1' }], uncovered: [{ id: 'R-2' }] });
  });
});

describe('отчёт сборки раннера', () => {
  const json = JSON.stringify({ testResults: [
    { name: 'D:\\proj\\tests\\a.spec.ts', status: 'passed', assertionResults: [{ status: 'passed' }] },
    { name: '/ci/work/tests/b.spec.ts', status: 'failed', assertionResults: [{ status: 'failed' }, { status: 'passed' }] },
    { name: '/ci/work/tests/c.spec.ts', status: 'passed', assertionResults: [{ status: 'pending' }] }
  ] });
  const xml = '<testsuite><testcase classname="svc/test_orders.py" name="a"/><testcase classname="svc/test_orders.py" name="b"><failure message="x"/></testcase><testcase file="pkg/cart_test.go" name="c"><skipped/></testcase></testsuite>';
  it('JSON-отчёт: итог по файлу, пути с обратными слешами', () => {
    expect(parseJsonReport(json)).toEqual([{ file: 'D:/proj/tests/a.spec.ts', state: 'passed' }, { file: '/ci/work/tests/b.spec.ts', state: 'failed' }, { file: '/ci/work/tests/c.spec.ts', state: 'skipped' }]);
  });
  it('JUnit: провал любого случая — провал файла; skipped отдельно', () => {
    expect(parseJunit(xml)).toEqual([{ file: 'svc/test_orders.py', state: 'failed' }, { file: 'pkg/cart_test.go', state: 'skipped' }]);
  });
  it('формат по содержимому; мусор — пусто', () => {
    expect(parseTestReport(json).format).toBe('json');
    expect(parseTestReport(xml).format).toBe('junit');
    expect(parseTestReport('просто текст')).toEqual({ format: null, results: [] });
    expect(parseTestReport('{ сломано')).toEqual({ format: null, results: [] });
  });
  it('итог проверки — по файлу из её команды; пути сравниваются по хвосту; лишнее называется', () => {
    const { verifications, unmatched } = verificationsFromReport(parseJsonReport(json), [
      { id: 'V-1', files: ['tests/a.spec.ts'] }, { id: 'V-2', files: ['tests/b.spec.ts'] }, { id: 'V-3', files: ['tests/none.spec.ts'] }
    ]);
    expect(verifications).toEqual({ 'V-1': 'passed', 'V-2': 'failed' });
    expect(unmatched).toEqual(['/ci/work/tests/c.spec.ts']);
  });
});

describe('на настоящем проекте: тесты → проверки → отчёт сборки', () => {
  it('находит тест, заводит проверку-черновик с командой, не задваивает, подключает отчёт', () => {
    const root = mkdtempSync(join(tmpdir(), 'docdd-tc-'));
    try {
      mkdirSync(join(root, 'docs', 'development'), { recursive: true });
      mkdirSync(join(root, 'tests'), { recursive: true });
      mkdirSync(join(root, 'reports'), { recursive: true });
      writeFileSync(join(root, 'docs', 'development', 'project.yaml'), manifestYaml({ id: 'tc', name: 'Tc' }), 'utf8');
      writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '2' } }), 'utf8');
      writeFileSync(join(root, 'tests', 'board.spec.ts'), '// проверяет R-0001\nexport {};', 'utf8');
      writeFileSync(join(root, 'tests', 'unrelated.spec.ts'), 'export {};', 'utf8');
      const made = createRecords(root, [{ key: 'r', type: 'requirement', title: 'Доска задач' }], []);
      expect(made.ok).toBe(true);

      const before = scanTests(root);
      expect(before.found).toBe(2);
      expect(before.matches.filter((m) => m.requirement).map((m) => `${m.test.path}→${m.requirement!.id}`)).toEqual(['tests/board.spec.ts→R-0001']);
      expect(before.coverage.percent).toBe(0);

      const first = createTestChecks(root);
      expect(first).toMatchObject({ ok: true, created: 1 });
      expect(createTestChecks(root)).toMatchObject({ ok: true, created: 0 });
      const folder = join(root, 'docs', 'development', 'tests');
      const file = readdirSync(folder).find((name) => name.startsWith('V-'))!;
      expect(readFileSync(join(folder, file), 'utf8')).toContain('Запуск: `npm run test -- tests/board.spec.ts`');
      expect(scanTests(root).coverage.percent).toBe(100);

      writeFileSync(join(root, 'reports', 'junit.xml'), '<testsuite><testcase classname="tests/board.spec.ts" name="a"/><testcase classname="tests/other.spec.ts" name="b"/></testsuite>', 'utf8');
      const connected = connectReport(root, 'reports/junit.xml');
      expect(connected).toMatchObject({ ok: true, matched: 1, format: 'junit', unmatched: ['tests/other.spec.ts'] });
      const reports = readdirSync(join(folder, 'reports'));
      expect(JSON.parse(readFileSync(join(folder, 'reports', reports[0]!), 'utf8'))).toMatchObject({ runner: 'ci:junit', verifications: { 'V-0001': 'passed' } });
      expect(connectReport(root, 'reports/nope.xml')).toMatchObject({ ok: false, code: 'report_not_found' });
      expect(() => connectReport(root, '../outside.xml')).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
