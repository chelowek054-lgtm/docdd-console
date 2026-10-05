import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkArchitecture, fixTaskOf, parseArchitectureAudit, selectionState, type ArchImport } from '../server/lib/architecture';
import { FOUND_MARKER, MODULES_MARKER, RULES_MARKER, architecturePrompt } from '../server/lib/prompt';
import { architectureRules } from '../server/lib/rules';
import { recordTemplate } from '../server/lib/scaffold';
import { validateProject } from '../server/lib/schema';
import type { ArchitectureConfig, WorkRecord } from '../server/lib/types';
import { codes as codesOf, context, rec } from './helpers';

/**
 * Точная проверка архитектуры (docs/07-maps.md, «Модули и публичный вход»):
 * вход по соглашению языка, пять правил, слои, подсказка «поднять».
 */

const edge = (from: string, to: string): ArchImport => ({ from, to, declaredBy: 'M-0001' });

function run(config: ArchitectureConfig, files: string[], imports: ArchImport[]) {
  return checkArchitecture({ config, files, modules: [], imports });
}

const codes = (config: ArchitectureConfig, files: string[], imports: ArchImport[]) =>
  run(config, files, imports).findings.map((finding) => finding.code);

/** Подключаемые модули — «закрытые»: снаружи только вход (в Python по умолчанию пакеты открыты). */
const CLOSED: ArchitectureConfig = { modules: [{ path: 'app/**', entry: 'closed' }] };

const PY = [
  'app/main.py',
  'app/knowledge/__init__.py',
  'app/knowledge/engine.py',
  'app/knowledge/repeat/__init__.py',
  'app/knowledge/repeat/cards.py',
  'app/billing/__init__.py',
  'app/billing/invoice.py'
];

describe('вход модуля: «через вход»', () => {
  it('импорт входа снаружи допустим', () => {
    expect(codes({}, PY, [edge('app/main.py', 'app/knowledge/__init__.py')])).toEqual([]);
  });

  it('импорт в глубину, мимо входа, — arch_entry_bypassed', () => {
    const result = run(CLOSED, PY, [edge('app/main.py', 'app/knowledge/engine.py')]);
    expect(result.findings.map((item) => item.code)).toEqual(['arch_entry_bypassed']);
    expect(result.findings[0]?.declaredBy).toBe('M-0001');
    expect(result.findings[0]?.message).toContain('app/knowledge');
    // Имя входа в обратных кавычках: иначе markdown съест подчёркивания в `__init__.py`.
    expect(result.findings[0]?.message).toContain('(`__init__.py`)');
  });

  it('внутри модуля вход обходить можно', () => {
    expect(codes({}, PY, [edge('app/knowledge/engine.py', 'app/knowledge/repeat/__init__.py')])).toEqual([]);
  });

  it('требуется вход самого внешнего пересечённого модуля, а не вложенного', () => {
    const found = codes(CLOSED, PY, [edge('app/main.py', 'app/knowledge/repeat/__init__.py')]);
    expect(found).toContain('arch_entry_bypassed');
    expect(found).not.toContain('arch_parent_import');
  });

  it('TypeScript: index.ts — вход, Vue-файл внутри — внутренность', () => {
    const files = ['src/pages/home/index.ts', 'src/features/auth/index.ts', 'src/features/auth/Form.vue'];
    expect(codes({}, files, [edge('src/pages/home/index.ts', 'src/features/auth/index.ts')])).toEqual([]);
    expect(codes({}, files, [edge('src/pages/home/index.ts', 'src/features/auth/Form.vue')])).toEqual(['arch_entry_bypassed']);
  });

  it('своё соглашение о входе: entries переопределяет умолчание', () => {
    const files = ['src/a/public.ts', 'src/a/private.ts', 'src/main.ts'];
    const config = { entries: { typescript: ['public.ts'] } };
    expect(codes(config, files, [edge('src/main.ts', 'src/a/public.ts')])).toEqual([]);
    expect(codes(config, files, [edge('src/main.ts', 'src/a/private.ts')])).toEqual(['arch_entry_bypassed']);
  });
});

describe('языки без соглашения и dotted-имена', () => {
  it('Kotlin и Java не проверяются, а экран знает об этом числом', () => {
    const result = run({}, ['app/A.kt', 'app/b/B.kt'], [edge('app/A.kt', 'app/b/B.kt')]);
    expect(result.findings).toEqual([]);
    expect(result.checked).toBe(0);
    expect(result.total).toBe(1);
  });

  it('Kotlin проверяется, когда проект назвал вход', () => {
    const files = ['app/main/Main.kt', 'app/core/Api.kt', 'app/core/Impl.kt'];
    const result = run({ entries: { kotlin: ['Api.kt'] } }, files, [edge('app/main/Main.kt', 'app/core/Impl.kt')]);
    expect(result.findings.map((item) => item.code)).toEqual(['arch_entry_bypassed']);
    expect(result.checked).toBe(1);
  });

  it('dotted-имя пакета находится по файлам', () => {
    const result = checkArchitecture({
      config: CLOSED,
      files: PY,
      modules: [],
      imports: [edge('app/main.py', 'knowledge.engine')]
    });
    expect(result.findings.map((item) => item.code)).toEqual(['arch_entry_bypassed']);
  });

  it('файл не найден — не проверено, а не нарушение', () => {
    const result = run({}, PY, [edge('app/main.py', 'app/ghost/x.py')]);
    expect(result.findings).toEqual([]);
    expect(result.checked).toBe(0);
  });

  it('Go: вложенный каталог — свой пакет, а не подмодуль родителя', () => {
    const files = ['cmd/main.go', 'pkg/a/a.go', 'pkg/a/b/b.go'];
    expect(codes({}, files, [edge('cmd/main.go', 'pkg/a/b/b.go')])).toEqual([]);
  });
});

describe('«не вверх»', () => {
  it('подмодуль, импортирующий родителя, — arch_parent_import', () => {
    expect(codes({}, PY, [edge('app/knowledge/repeat/cards.py', 'app/knowledge/__init__.py')])).toEqual(['arch_parent_import']);
    expect(codes({}, PY, [edge('app/knowledge/repeat/cards.py', 'app/knowledge/engine.py')])).toEqual(['arch_parent_import']);
  });

  it('родитель, собирающий детей, — норма', () => {
    expect(codes({}, PY, [edge('app/knowledge/engine.py', 'app/knowledge/repeat/__init__.py')])).toEqual([]);
  });
});

describe('соседи', () => {
  it('по умолчанию — через вход соседа', () => {
    expect(codes({}, PY, [edge('app/billing/invoice.py', 'app/knowledge/__init__.py')])).toEqual([]);
  });

  it('via-parent: соседи друг друга не знают', () => {
    expect(codes({ siblings: 'via-parent' }, PY, [edge('app/billing/invoice.py', 'app/knowledge/__init__.py')]))
      .toEqual(['arch_sibling_import']);
  });

  it('via-parent: родитель по-прежнему собирает детей', () => {
    expect(codes({ siblings: 'via-parent' }, PY, [edge('app/main.py', 'app/billing/__init__.py')])).toEqual([]);
  });

  it('shared и kernel соседями не считаются', () => {
    const files = [...PY, 'app/shared/__init__.py'];
    expect(codes({ siblings: 'via-parent', shared: ['app/shared'] }, files, [edge('app/billing/invoice.py', 'app/shared/__init__.py')])).toEqual([]);
  });
});

describe('циклы', () => {
  it('два соседа, зависящие друг от друга, — arch_cycle на обоих импортах', () => {
    const found = run({}, PY, [
      edge('app/billing/invoice.py', 'app/knowledge/__init__.py'),
      edge('app/knowledge/engine.py', 'app/billing/__init__.py')
    ]).findings;
    expect(found.map((item) => item.code)).toEqual(['arch_cycle', 'arch_cycle']);
  });

  it('зависимость в одну сторону — не цикл', () => {
    expect(codes({}, PY, [edge('app/billing/invoice.py', 'app/knowledge/__init__.py')])).toEqual([]);
  });
});

describe('shared и kernel', () => {
  const files = [
    'app/main.py',
    'app/shared/__init__.py', 'app/shared/dates.py',
    'app/kernel/__init__.py', 'app/kernel/money.py',
    'app/billing/__init__.py', 'app/billing/invoice.py'
  ];
  const config = { shared: ['app/shared'], kernel: ['app/kernel'] };

  it('shared, импортирующий домен или kernel, — arch_shared_imports_domain', () => {
    expect(codes(config, files, [edge('app/shared/dates.py', 'app/billing/__init__.py')])).toEqual(['arch_shared_imports_domain']);
    expect(codes(config, files, [edge('app/shared/dates.py', 'app/kernel/__init__.py')])).toEqual(['arch_shared_imports_domain']);
  });

  it('kernel, импортирующий домен, — arch_kernel_imports_domain', () => {
    expect(codes(config, files, [edge('app/kernel/money.py', 'app/billing/__init__.py')])).toEqual(['arch_kernel_imports_domain']);
  });

  it('kernel импортирует shared, домен — kernel и shared: всё допустимо', () => {
    expect(codes(config, files, [
      edge('app/kernel/money.py', 'app/shared/__init__.py'),
      edge('app/billing/invoice.py', 'app/kernel/__init__.py'),
      edge('app/billing/invoice.py', 'app/shared/__init__.py')
    ])).toEqual([]);
  });

  it('shared не захватывает каталог с похожим именем', () => {
    const more = [...files, 'app/shared-ui/__init__.py', 'app/shared-ui/x.py'];
    expect(codes(config, more, [edge('app/shared-ui/x.py', 'app/billing/__init__.py')])).toEqual([]);
  });
});

describe('слои', () => {
  const fsd = {
    layers: [{ root: 'src', order: ['app', 'pages', 'widgets', 'features', 'entities', 'shared'] }]
  };
  const files = [
    'src/pages/home/index.ts',
    'src/features/auth/index.ts', 'src/features/auth/ui/Form.vue',
    'src/features/cart/index.ts',
    'src/entities/user/index.ts', 'src/entities/user/@x/order.ts',
    'src/entities/order/index.ts',
    'src/shared/ui/index.ts'
  ];

  it('импорт вниз допустим, вверх — arch_layer_up', () => {
    expect(codes(fsd, files, [edge('src/pages/home/index.ts', 'src/features/auth/index.ts')])).toEqual([]);
    expect(codes(fsd, files, [edge('src/entities/user/index.ts', 'src/features/auth/index.ts')])).toEqual(['arch_layer_up']);
  });

  it('срезы одного слоя друг друга не знают — arch_slice_cross', () => {
    expect(codes(fsd, files, [edge('src/features/auth/index.ts', 'src/features/cart/index.ts')])).toEqual(['arch_slice_cross']);
  });

  it('@x — явное исключение у entities', () => {
    expect(codes(fsd, files, [edge('src/entities/order/index.ts', 'src/entities/user/@x/order.ts')])).toEqual([]);
  });

  it('slices: via-entry — соседний срез допустим через вход', () => {
    const config = { layers: [{ root: 'src', order: ['app', 'pages', 'widgets', 'features', 'entities', 'shared'], slices: 'via-entry' as const }] };
    expect(codes(config, files, [edge('src/features/auth/index.ts', 'src/features/cart/index.ts')])).toEqual([]);
  });

  it('бэкенд: api → modules → platform, срезы via-entry', () => {
    const backend = { layers: [{ root: 'srv', order: ['api', 'modules', 'platform'], slices: 'via-entry' as const }] };
    const bfiles = ['srv/api/orders/index.ts', 'srv/modules/billing/index.ts', 'srv/modules/stock/index.ts', 'srv/platform/log/index.ts'];
    expect(codes(backend, bfiles, [
      edge('srv/api/orders/index.ts', 'srv/modules/billing/index.ts'),
      edge('srv/modules/billing/index.ts', 'srv/modules/stock/index.ts'),
      edge('srv/modules/billing/index.ts', 'srv/platform/log/index.ts')
    ])).toEqual([]);
    expect(codes(backend, bfiles, [edge('srv/platform/log/index.ts', 'srv/api/orders/index.ts')])).toEqual(['arch_layer_up']);
  });

  it('слои не отключают проверку siblings вне профиля', () => {
    const config = { ...fsd, siblings: 'via-parent' as const };
    const more = [...files, 'lib/a/index.ts', 'lib/b/index.ts'];
    expect(codes(config, more, [edge('lib/a/index.ts', 'lib/b/index.ts')])).toEqual(['arch_sibling_import']);
    expect(codes(config, more, [edge('src/pages/home/index.ts', 'src/features/auth/index.ts')])).toEqual([]);
  });
});

describe('подсказка «поднять»', () => {
  const files = [
    'app/billing/__init__.py',
    'app/billing/invoices/__init__.py',
    'app/billing/invoices/lines/__init__.py',
    'app/billing/invoices/lines/tax/__init__.py',
    'app/reports/__init__.py',
    'app/reports/summary.py'
  ];

  it('глубокий модуль, нужный в другой ветке, — arch_promote с ближайшим общим предком', () => {
    const found = run({}, files, [
      edge('app/billing/invoices/lines/__init__.py', 'app/billing/invoices/lines/tax/__init__.py'),
      edge('app/reports/summary.py', 'app/billing/invoices/lines/tax/__init__.py')
    ]).findings;
    const promote = found.find((item) => item.code === 'arch_promote');
    expect(promote).toBeDefined();
    expect(promote?.message).toContain('app/billing/invoices/lines/tax');
    expect(promote?.message).toContain('`shared`');
  });

  it('общий предок не корень — подсказка называет его', () => {
    const more = [...files, 'app/billing/refunds/__init__.py'];
    const found = run({}, more, [
      edge('app/billing/invoices/lines/__init__.py', 'app/billing/invoices/lines/tax/__init__.py'),
      edge('app/billing/refunds/__init__.py', 'app/billing/invoices/lines/tax/__init__.py')
    ]).findings.find((item) => item.code === 'arch_promote');
    expect(promote(found)).toContain('app/billing');
  });

  it('использование только внутри родителя подсказки не даёт', () => {
    const found = codes({}, files, [edge('app/billing/invoices/lines/__init__.py', 'app/billing/invoices/lines/tax/__init__.py')]);
    expect(found).not.toContain('arch_promote');
  });

  it('shared и kernel — уже библиотека, поднимать их некуда', () => {
    const lib = ['app/shared/__init__.py', 'app/shared/ui/__init__.py', 'app/a/__init__.py'];
    const found = codes({ shared: ['app/shared'] }, lib, [edge('app/a/__init__.py', 'app/shared/ui/__init__.py')]);
    expect(found).not.toContain('arch_promote');
  });
});

function promote(finding: { message: string } | undefined): string {
  return finding?.message ?? '';
}

describe('покрытие', () => {
  it('считает проверенные импорты из всех', () => {
    const result = run({}, PY, [
      edge('app/main.py', 'app/knowledge/__init__.py'),
      edge('app/main.py', 'app/ghost/x.py'),
      edge('app/main.py', 'unknown.txt')
    ]);
    expect(result.total).toBe(3);
    expect(result.checked).toBe(1);
  });

  it('модули называются с родителем', () => {
    const modules = run({}, PY, []).modules;
    const repeat = modules.find((item) => item.dir === 'app/knowledge/repeat');
    expect(repeat?.parent).toBe('app/knowledge');
    expect(modules.find((item) => item.dir === 'app/knowledge')?.parent).toBeNull();
  });
});

describe('правило в общем проходе', () => {
  const codemap = (status: string): WorkRecord => rec('M-0001', 'map', status, {
    section: null,
    path: 'docs/development/maps/M-0001-karta.md',
    updated: '2026-09-01',
    body: ['# Карта', '', '```docdd-codemap', JSON.stringify({
      added: {
        modules: [{ id: 'app/main.py' }, { id: 'app/knowledge/engine.py' }],
        imports: [{
          from: 'app/main.py', to: 'app/knowledge/engine.py',
          evidence: { path: 'app/main.py', line: 1, fragment: 'from app.knowledge.engine import run' }
        }]
      }
    }), '```'].join(String.fromCharCode(10))
  });
  const withConfig = (records: WorkRecord[], config?: ArchitectureConfig) => ({
    ...context(records, { codeFiles: PY }),
    ...(config ? { architecture: config } : {})
  });

  it('нет секции architecture — нет проверки', () => {
    expect(architectureRules(withConfig([codemap('approved')]))).toEqual([]);
  });

  it('нарушение висит на карте, объявившей импорт', () => {
    const found = architectureRules(withConfig([codemap('approved')], CLOSED));
    expect(codesOf(found)).toEqual(['arch_entry_bypassed']);
    expect(found[0]?.id).toBe('M-0001');
    expect(found[0]?.path).toBe('docs/development/maps/M-0001-karta.md');
    expect(found[0]?.level).toBe('warning');
  });

  it('неподтверждённая карта в проверку не идёт', () => {
    expect(architectureRules(withConfig([codemap('draft')], {}))).toEqual([]);
  });
});

describe('секция architecture манифеста', () => {
  const base = { contract: 'docdd.workspace/1', project: { id: 'p', name: 'P' }, paths: {} };

  it('полная секция проходит схему', () => {
    expect(validateProject({
      ...base,
      architecture: {
        entries: { python: ['__init__.py'] },
        shared: ['app/shared'],
        kernel: ['app/kernel'],
        siblings: 'via-parent',
        layers: [{ root: 'src', order: ['app', 'shared'], slices: 'isolated' }]
      }
    })).toEqual([]);
  });

  it('незнакомый режим соседей и профиль в одну ступень отвергаются', () => {
    expect(validateProject({ ...base, architecture: { siblings: 'anyhow' } })).not.toEqual([]);
    expect(validateProject({ ...base, architecture: { layers: [{ root: 'src', order: ['app'] }] } })).not.toEqual([]);
  });
});

describe('аудит моделью: разбор ответа', () => {
  const files = ['learningFront/src/features/ielts/ui/Form.vue', 'learningBack/core/__init__.py'];
  const block = (findings: unknown) => ['Пара строк.', '```docdd-architecture', JSON.stringify({ findings }), '```'].join('\n');

  it('берёт находки с известным видом и существующим путём', () => {
    const result = parseArchitectureAudit(block([
      { path: 'learningFront/src/features/ielts/ui/Form.vue', kind: 'logic_in_ui', note: ' расчёт в компоненте ' }
    ]), files);
    expect(result?.findings).toEqual([
      { path: 'learningFront/src/features/ielts/ui/Form.vue', kind: 'logic_in_ui', note: 'расчёт в компоненте' }
    ]);
    expect(result?.skipped).toEqual([]);
  });

  it('каталог тоже путь: модуль целиком', () => {
    const result = parseArchitectureAudit(block([{ path: 'learningBack/core', kind: 'many_tasks', note: '' }]), files);
    expect(result?.findings).toHaveLength(1);
  });

  it('чужой вид и несуществующий путь не теряются молча', () => {
    const result = parseArchitectureAudit(block([
      { path: 'learningBack/core', kind: 'smelly', note: '' },
      { path: 'nope/x.ts', kind: 'duplicate', note: '' },
      { kind: 'duplicate' }
    ]), files);
    expect(result?.findings).toEqual([]);
    expect(result?.skipped.map((item) => item.reason)).toEqual([
      expect.stringContaining('вид не из списка'),
      expect.stringContaining('нет в проекте'),
      expect.stringContaining('не назван путь')
    ]);
  });

  it('повтор пути и вида схлопывается', () => {
    const twice = { path: 'learningBack/core', kind: 'many_tasks', note: 'а' };
    expect(parseArchitectureAudit(block([twice, { ...twice, note: 'б' }]), files)?.findings).toHaveLength(1);
  });

  it('блока нет или он не разбирается — null, ответ остаётся текстом', () => {
    expect(parseArchitectureAudit('просто текст', files)).toBeNull();
    expect(parseArchitectureAudit('```docdd-architecture\n{oops\n```', files)).toBeNull();
    expect(parseArchitectureAudit('```docdd-architecture\n{"x":1}\n```', files)).toBeNull();
  });
});

describe('аудит моделью: сборка запроса', () => {
  const template = '# Запрос\n\n---\n\nПравила:\n<!-- ПРАВИЛА -->\nМодули:\n<!-- МОДУЛИ -->\nНайдено:\n<!-- НАХОДКИ -->\n';
  const modules = [
    { dir: 'app/knowledge', entry: 'app/knowledge/__init__.py', parent: null },
    { dir: 'app/knowledge/repeat', entry: 'app/knowledge/repeat/__init__.py', parent: 'app/knowledge' }
  ];

  it('подставляет правила, дерево с отступами и находки', () => {
    const text = architecturePrompt(template, {
      rules: { siblings: 'via-parent', shared: ['app/shared'], layers: [{ root: 'src', order: ['app', 'shared'] }] },
      modules,
      found: [{ code: 'arch_entry_bypassed', from: 'a.py', to: 'b.py' }]
    });
    expect(text).toContain('- соседи: не знают друг друга, связывает родитель');
    expect(text).toContain('- shared (технический общий код, без домена): app/shared');
    expect(text).toContain('слои в `src` сверху вниз: app → shared; срезы друг друга не знают');
    expect(text).toContain('- `app/knowledge` (вход: __init__.py)');
    expect(text).toContain('  - `app/knowledge/repeat` (вход: __init__.py)');
    expect(text).toContain('`arch_entry_bypassed`: `a.py` → `b.py`');
    expect(text).not.toContain('<!--');
  });

  it('ничего не нашли — так и говорит', () => {
    expect(architecturePrompt(template, { rules: {}, modules, found: [] })).toContain('Точная проверка ничего не нашла.');
  });

  it('настоящий шаблон из репозитория содержит все три места подстановки', () => {
    const real = readFileSync(new URL('../docs/prompts/architecture-audit.md', import.meta.url), 'utf8');
    for (const marker of [RULES_MARKER, MODULES_MARKER, FOUND_MARKER]) expect(real).toContain(marker);
  });
});

describe('галочка «Выбрать все»', () => {
  it('все, ни одной или часть', () => {
    expect(selectionState(5, 5)).toBe(true);
    expect(selectionState(5, 0)).toBe(false);
    expect(selectionState(5, 2)).toBe('indeterminate');
  });

  it('нарушений нет — не «отмечено»', () => {
    expect(selectionState(0, 0)).toBe(false);
  });
});

describe('задача «Починить нарушения»', () => {
  const found = [
    { code: 'arch_entry_bypassed', from: 'app/main.py', to: 'app/knowledge/engine.py', evidence: { path: 'app/main.py', line: 3 }, map: 'M-0002', message: 'в обход входа' },
    { code: 'arch_layer_up', from: 'a.ts', to: 'b.ts', map: 'M-0001', message: 'вверх по слоям' },
    { code: 'arch_cycle', from: 'c.ts', to: 'd.ts', map: 'M-0002', message: 'цикл' },
    { code: 'arch_promote', from: 'e.ts', to: 'f.ts', map: 'M-0005', message: 'поднять' }
  ];

  it('подсказка «поднять» в задачу не входит, карты — без повторов и по порядку', () => {
    const task = fixTaskOf(found);
    expect(task?.count).toBe(3);
    expect(task?.title).toBe('Починить нарушения архитектуры: 3');
    expect(task?.affects).toEqual(['M-0001', 'M-0002']);
    expect(task?.body).not.toContain('arch_promote');
  });

  it('в теле — код правила, файл и строка, объяснение; без строки — файл-источник', () => {
    const body = fixTaskOf(found)?.body ?? '';
    expect(body).toContain('- `arch_entry_bypassed` — `app/main.py:3`: в обход входа');
    expect(body).toContain('- `arch_layer_up` — `a.ts`: вверх по слоям');
  });

  it('нечего чинить — null: кнопка неактивна', () => {
    expect(fixTaskOf([])).toBeNull();
    expect(fixTaskOf([found[3] as (typeof found)[number]])).toBeNull();
  });

  it('текст попадает в тело задачи шаблона, а не заменяется подсказкой', () => {
    const task = fixTaskOf(found);
    const text = recordTemplate({
      id: 'T-0001', type: 'task', title: task?.title ?? '', today: '2026-10-05', change: 'fix',
      body: task?.body ?? '', links: { affects: task?.affects ?? [] }
    });
    expect(text).toContain('change: fix');
    expect(text).toContain('affects: [M-0001, M-0002]');
    expect(text).toContain('- `arch_cycle` — `c.ts`: цикл');
    expect(text).not.toContain('Зачем это, что делаем');
  });
});

describe('правила из практик: словарь', () => {
  it('Python по умолчанию открыт: публичный подмодуль можно, приватный (_) нельзя', () => {
    const files = [...PY, 'app/knowledge/_cache.py'];
    expect(codes({}, files, [edge('app/main.py', 'app/knowledge/engine.py')])).toEqual([]);
    expect(codes({}, files, [edge('app/main.py', 'app/knowledge/_cache.py')])).toEqual(['arch_private_import']);
  });

  it('closed для части путей, остальное по языку', () => {
    const config: ArchitectureConfig = { modules: [{ path: 'app/billing', entry: 'closed' }] };
    expect(codes(config, PY, [edge('app/main.py', 'app/billing/invoice.py')])).toEqual(['arch_entry_bypassed']);
    expect(codes(config, PY, [edge('app/main.py', 'app/knowledge/engine.py')])).toEqual([]);
  });

  it('тесты, скрипты и миграции вне проверки; unignore возвращает', () => {
    const files = [...PY, 'app/tests/test_x.py', 'app/migrations/0001.py'];
    const config: ArchitectureConfig = { modules: [{ path: 'app/**', entry: 'closed' }] };
    const result = run(config, files, [edge('app/tests/test_x.py', 'app/knowledge/engine.py'), edge('app/migrations/0001.py', 'app/knowledge/engine.py')]);
    expect(result.findings).toEqual([]);
    expect(result.unchecked['ignored']).toBe(2);
    expect(codes({ ...config, unignore: ['**/tests/**'] }, files, [edge('app/tests/test_x.py', 'app/knowledge/engine.py')])).toEqual(['arch_entry_bypassed']);
  });

  it('independent: соседи не знают друг друга даже через вход', () => {
    const config: ArchitectureConfig = { independent: ['app/*'] };
    expect(codes(config, PY, [edge('app/billing/invoice.py', 'app/knowledge/__init__.py')])).toEqual(['arch_not_independent']);
    expect(codes(config, PY, [edge('app/main.py', 'app/knowledge/__init__.py')])).toEqual([]);
  });

  it('forbidden: запрет «откуда → куда» называет причину и запись', () => {
    const files = ['src/shared/ui/index.ts', 'src/shared/api/index.ts', 'src/shared/lib/index.ts'];
    const config: ArchitectureConfig = { forbidden: [{ from: 'src/shared/ui', to: ['src/shared/api'], why: 'UI-кит не знает про API', source: 'A-0020' }] };
    const found = run(config, files, [edge('src/shared/ui/index.ts', 'src/shared/api/index.ts'), edge('src/shared/ui/index.ts', 'src/shared/lib/index.ts')]).findings;
    expect(found.map((item) => item.code)).toEqual(['arch_forbidden']);
    expect(found[0]?.message).toContain('UI-кит не знает про API');
    expect(found[0]?.message).toContain('A-0020');
  });

  it('unsliced: сегменты shared друг друга видят, срезы features — нет', () => {
    const files = ['src/shared/ui/index.ts', 'src/shared/lib/index.ts', 'src/features/a/index.ts', 'src/features/b/index.ts'];
    const config: ArchitectureConfig = { layers: [{ root: 'src', order: ['features', 'shared'], slices: 'isolated', unsliced: ['shared'] }] };
    expect(codes(config, files, [edge('src/shared/ui/index.ts', 'src/shared/lib/index.ts')])).toEqual([]);
    expect(codes(config, files, [edge('src/features/a/index.ts', 'src/features/b/index.ts')])).toEqual(['arch_slice_cross']);
  });
});
