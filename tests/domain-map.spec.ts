import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { analyze } from '../server/lib/analyze';
import { checkArchitecture, AUDIT_KINDS } from '../server/lib/architecture';
import {
  architectRefusal, contextTrees, domainFindings, domainText, emptyDomain, profileUses,
  type DomainInput, type DomainState
} from '../server/lib/domain-map';
import { parseProposal } from '../server/lib/inbox';
import { foldMaps, parseMapRecord } from '../server/lib/maps';
import { checklist, EMPTY_STATE } from '../server/lib/onboarding';
import { resolveRules, type RuleRecord } from '../server/lib/practice-rules';
import { architecturePrompt, taskPrompt } from '../server/lib/prompt';
import { domainRules } from '../server/lib/rules';
import { recordTemplate } from '../server/lib/scaffold';
import { validateFrontMatter } from '../server/lib/schema';
import { readWorkspace } from '../server/lib/workspace';
import { bulkStatus } from '../server/utils/bulk-service';
import { context, rec } from './helpers';

/** DDD + Clean как основа (A-0004): R-0118…R-0121, проверки V-0128…V-0131. */

const LF = String.fromCharCode(10);
const FENCE = '```';
const here = fileURLToPath(new URL('..', import.meta.url));

/** Подтверждённые практики встроенного набора с тегами — как их читает `generalRuleRecords`. */
function builtinRules(tags: readonly string[]): RuleRecord[] {
  if (tags.length === 0) return [];
  const workspace = readWorkspace(join(here, 'practices'));
  const { records } = analyze({ files: workspace.files, manifest: workspace.manifest });
  return records
    .filter((record) => (record.type === 'decision' || record.type === 'design') && record.status === 'approved')
    .filter((record) => (Array.isArray(record.data['tags']) ? (record.data['tags'] as string[]) : []).some((tag) => tags.includes(tag)))
    .map((record) => ({ id: record.id, label: 'docdd', body: record.body }));
}

const orders: DomainState = {
  contexts: [{ id: 'orders', title: 'Заказы', kind: 'core', root: 'src/orders', capabilities: ['zakaz'], language: [{ term: 'подтверждённый заказ', code: 'Order.confirm' }] }],
  aggregates: [{ id: 'order', context: 'orders', root: 'Order', invariants: ['заказ не оплачивается дважды'] }],
  relations: []
};

const FILES = [
  'src/orders/domain/index.ts', 'src/orders/domain/trip.ts',
  'src/orders/application/index.ts',
  'src/orders/infrastructure/index.ts', 'src/orders/infrastructure/repo.ts',
  'src/orders/interface/index.ts', 'src/orders/interface/http.ts'
];
const MODULES = ['domain', 'application', 'infrastructure', 'interface'].map((layer) => ({ id: `src/orders/${layer}`, path: `src/orders/${layer}` }));
const edge = (from: string, to: string) => ({ from, to, declaredBy: 'M-0001' });

describe('практика DDD + Clean (V-0128)', () => {
  const run = (tags: readonly string[], imports: ReturnType<typeof edge>[]) => {
    const rules = resolveRules({ general: builtinRules(tags), local: [], auto: profileUses(orders) });
    if (!rules.config) return null;
    return checkArchitecture({ config: rules.config, files: FILES, modules: MODULES, imports }).findings.map((item) => item.code);
  };

  it('встроенная практика с тегом general объявляет профиль ddd-clean', () => {
    const own = builtinRules(['general']).find((record) => record.body.includes('"profile": "ddd-clean"'));
    expect(own).toBeDefined();
    expect(own?.body).toContain('Политика');
  });

  it('профиль ложится на корень контекста сам: импорт domain → infrastructure — arch_layer_up', () => {
    expect(run(['general'], [edge('src/orders/domain/trip.ts', 'src/orders/infrastructure/index.ts')])).toEqual(['arch_layer_up']);
  });

  it('interface → infrastructure — arch_forbidden с причиной; внутрь — тишина', () => {
    expect(run(['general'], [edge('src/orders/interface/http.ts', 'src/orders/infrastructure/index.ts')])).toEqual(['arch_forbidden']);
    expect(run(['general'], [
      edge('src/orders/infrastructure/repo.ts', 'src/orders/domain/index.ts'),
      edge('src/orders/interface/http.ts', 'src/orders/application/index.ts'),
      edge('src/orders/application/index.ts', 'src/orders/domain/index.ts')
    ])).toEqual([]);
  });

  it('практика выключена (tags: []) — профиля нет, правил нет', () => {
    expect(run([], [edge('src/orders/domain/trip.ts', 'src/orders/infrastructure/index.ts')])).toBeNull();
  });

  it('без доменной карты профиль сам не применяется', () => {
    const rules = resolveRules({ general: builtinRules(['general']), local: [], auto: profileUses(emptyDomain()) });
    expect(rules.config?.layers ?? []).toEqual([]);
  });

  it('use находит профиль по имени из блока', () => {
    const local: RuleRecord = { id: 'A-0100', body: [`${FENCE}docdd-rules`, JSON.stringify({ use: [{ profile: 'ddd-clean', root: 'src/billing' }] }), FENCE].join(LF) };
    const rules = resolveRules({ general: builtinRules(['general']), local: [local] });
    expect(rules.config?.layers?.map((item) => item.root)).toEqual(['src/billing']);
    expect(rules.problems).toEqual([]);
  });
});

describe('доменная карта: разбор и сложение (V-0129)', () => {
  const body = (value: unknown) => ['# Карта', '', `${FENCE}docdd-domain`, JSON.stringify(value), FENCE].join(LF);

  it('корректный блок складывается в картину, связь — по ключу from>to:kind', () => {
    const first = parseMapRecord(body({ added: orders }));
    expect(first.problems).toEqual([]);
    expect(first.present).toEqual(['domain']);
    const second = parseMapRecord(body({ added: { contexts: [{ id: 'billing', kind: 'supporting' }], relations: [{ from: 'billing', to: 'orders', kind: 'customer-supplier' }] }, removed: { aggregates: [{ id: 'order' }] } }));
    const folded = foldMaps([{ id: 'M-0001', change: first.change }, { id: 'M-0002', change: second.change }]);
    expect(folded.domain.contexts.map((item) => item.id)).toEqual(['orders', 'billing']);
    expect(folded.domain.aggregates).toEqual([]);
    expect(folded.domain.relations[0]).toMatchObject({ kind: 'customer-supplier', declaredBy: 'M-0002' });
  });

  it('битый JSON и чужое поле — ошибка разбора, а не молчание', () => {
    expect(parseMapRecord(['```docdd-domain', '{oops', '```'].join(LF)).problems[0]?.structure).toBe('domain');
    expect(parseMapRecord(body({ added: { contexts: [{ id: 'x', kind: 'main' }] } })).problems).toHaveLength(1);
  });
});

describe('доменная карта: предупреждения (V-0129)', () => {
  const input = (over: Partial<DomainInput> = {}): DomainInput => ({
    domain: orders, hasCode: true, capabilities: [], modules: [],
    decisions: [{ id: 'A-1', area: 'topology' }, { id: 'A-2', area: 'storage' }, { id: 'A-3', area: 'transactions' }],
    ...over
  });
  const codesOf = (over: Partial<DomainInput>) => domainFindings(input(over)).map((item) => item.code);

  it('чистый проект — ни одного', () => {
    expect(codesOf({ capabilities: [{ id: 'zakaz', priority: 'must', horizon: 'now' }], modules: MODULES })).toEqual([]);
  });

  it('карты нет: у проекта с кодом — domain_map_missing, без кода — тишина', () => {
    expect(codesOf({ domain: emptyDomain() })).toEqual(['domain_map_missing']);
    expect(codesOf({ domain: emptyDomain(), hasCode: false })).toEqual([]);
  });

  it('непокрытая must/now — да; подпункт покрытой — нет; should — нет', () => {
    expect(codesOf({ capabilities: [{ id: 'oplata', priority: 'must', horizon: 'now' }] })).toEqual(['domain_capability_uncovered']);
    expect(codesOf({ capabilities: [{ id: 'zakaz' }, { id: 'zakaz.korzina', parent: 'zakaz', priority: 'must', horizon: 'now' }] })).toEqual([]);
    expect(codesOf({ capabilities: [{ id: 'oplata', priority: 'should', horizon: 'now' }] })).toEqual([]);
  });

  it('модуль вне корней — domain_module_orphan; shared и kernel — не сироты', () => {
    expect(codesOf({ modules: [{ id: 'src/billing/index.ts', path: 'src/billing' }] })).toEqual(['domain_module_orphan']);
    expect(codesOf({ modules: [{ id: 'src/shared', path: 'src/shared' }], common: ['src/shared'] })).toEqual([]);
  });

  it('связь на неизвестный контекст, пустой словарь у core, агрегат без инвариантов', () => {
    expect(codesOf({ domain: { ...orders, relations: [{ from: 'orders', to: 'nikto', kind: 'conformist' }] } })).toEqual(['domain_relation_unknown']);
    expect(codesOf({ domain: { ...orders, contexts: [{ ...orders.contexts[0]!, language: [] }] } })).toEqual(['domain_language_empty']);
    expect(codesOf({ domain: { ...orders, aggregates: [{ id: 'order', context: 'orders' }] } })).toEqual(['domain_aggregate_no_invariants']);
  });

  it('правило в общем проходе: пробел карты — на манифесте проекта', () => {
    const found = domainRules(context([], { codeRoots: ['src'] }));
    expect(found.map((item) => item.code)).toEqual(['domain_map_missing']);
    expect(found[0]).toMatchObject({ path: 'docs/development/project.yaml', level: 'warning' });
  });

  it('чек-лист: доменная карта вторая, сразу за вектором', () => {
    expect(checklist(EMPTY_STATE).map((step) => step.id).slice(0, 2)).toEqual(['vision', 'domain']);
  });

  it('дерево: контекст → слой → модуль → файл, слои по порядку чистой архитектуры', () => {
    const [tree] = contextTrees(orders, MODULES, [...FILES, 'src/orders/tools/x.ts', 'src/other/y.ts']);
    expect(tree?.files).toBe(8);
    expect(tree?.layers.map((layer) => layer.layer)).toEqual(['interface', 'infrastructure', 'application', 'domain', 'tools']);
    expect(tree?.layers.at(-1)?.clean).toBe(false);
    expect(tree?.layers.find((layer) => layer.layer === 'domain')?.modules[0]).toMatchObject({ id: 'src/orders/domain', files: ['src/orders/domain/index.ts', 'src/orders/domain/trip.ts'] });
  });
});

describe('решения архитектора (V-0130)', () => {
  const decision = (area?: string) => ({ id: 'A-0009', type: 'decision', data: area ? { area } : {} });

  it('решение с area подтверждает только архитектор', () => {
    expect(architectRefusal(decision('storage'), 'approved', ['developer'])?.code).toBe('architect_only');
    expect(architectRefusal(decision('storage'), 'approved', ['developer', 'architect'])).toBeNull();
  });

  it('без area, без входа и не на подтверждение — правило молчит', () => {
    expect(architectRefusal(decision(), 'approved', ['developer'])).toBeNull();
    expect(architectRefusal(decision('topology'), 'approved', null)).toBeNull();
    expect(architectRefusal(decision('topology'), 'review', ['developer'])).toBeNull();
  });

  it('пустая область напоминает о себе по одному предупреждению', () => {
    const found = domainFindings({ domain: orders, hasCode: true, capabilities: [], modules: [], decisions: [{ id: 'A-1', area: 'storage' }, { id: 'A-2' }] });
    expect(found.filter((item) => item.code === 'arch_decision_missing').map((item) => item.message.includes('area: topology') || item.message.includes('area: transactions'))).toEqual([true, true]);
  });

  it('схема принимает area только из трёх значений', () => {
    const base = { id: 'A-0001', type: 'decision', title: 'Т', status: 'draft', created: '2026-11-11', updated: '2026-11-11' };
    expect(validateFrontMatter({ ...base, area: 'storage' })).toEqual([]);
    expect(validateFrontMatter({ ...base, area: 'cloud' }).length).toBeGreaterThan(0);
  });

  describe('массовая смена статуса', () => {
    let root = '';
    const put = (name: string, area: string) => {
      mkdirSync(join(root, 'docs', 'development', 'decisions'), { recursive: true });
      writeFileSync(join(root, 'docs', 'development', 'decisions', name), [
        '---', `id: ${name.slice(0, 6)}`, 'type: decision', 'title: Решение', 'status: review', `area: ${area}`,
        'created: 2026-11-11', 'updated: 2026-11-11', '---', '', '# Решение', '', 'Текст.', '', '## Журнал', '', '- 2026-11-11 · заведена · модель', ''
      ].join(LF), 'utf8');
    };
    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'docdd-architect-'));
      mkdirSync(join(root, 'docs', 'development'), { recursive: true });
      writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  decisions: decisions', ''].join(LF), 'utf8');
      put('A-0001-a.md', 'storage');
      put('A-0002-b.md', 'topology');
    });
    afterAll(() => {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* прибирать не обязательно */ }
    });

    it('разработчику — отказ строкой отчёта, архитектору — подтверждено', () => {
      const refused = bulkStatus(root, ['A-0001'], 'approve', 'developer', ['developer']);
      expect(refused.results[0]).toMatchObject({ ok: false, code: 'architect_only' });
      expect(readFileSync(join(root, 'docs', 'development', 'decisions', 'A-0001-a.md'), 'utf8')).toContain('status: review');
      const approved = bulkStatus(root, ['A-0002'], 'approve', 'architect', ['architect']);
      expect(approved.results[0]).toMatchObject({ ok: true });
    });
  });
});

describe('запросы модели (V-0131)', () => {
  const prompt = (name: string) => readFileSync(join(here, 'docs', 'prompts', name), 'utf8');

  it('шаблоны несут основу DDD + Clean и варианты для архитектора', () => {
    const task = prompt('task.md');
    for (const phrase of ['инварианты охраняет сущность или корень агрегата', 'объекты-значения', 'политика', 'словаря контекста', '**не выбирай**']) expect(task).toContain(phrase);
    expect(prompt('grill-plan.md')).toContain('`## Варианты`');
    expect(prompt('grill-plan.md')).toContain('Запись `map` с полем `domain`');
    expect(prompt('inbox-plan.md')).toContain('"domain": {');
    expect(prompt('architecture-audit.md')).toContain('<!-- ДОМЕН -->');
    for (const kind of ['setter_bypass', 'rule_in_application', 'mutable_value', 'aggregate_bypass', 'domain_framework', 'off_language']) {
      expect(AUDIT_KINDS).toContain(kind);
      expect(prompt('architecture-audit.md')).toContain(`\`${kind}\``);
    }
  });

  it('доменная карта текстом уходит в запрос на задачу и в аудит', () => {
    const text = domainText(orders);
    expect(text).toContain('корень `src/orders`');
    expect(text).toContain('подтверждённый заказ = `Order.confirm`');
    expect(text).toContain('инварианты: заказ не оплачивается дважды');
    const task = taskPrompt(prompt('task.md'), {
      id: 'T-1', title: 'Т', body: 'Сделать.', requirements: [], documents: [], map: '', modules: [], referenceIndex: null,
      practices: [], rework: '', round: 1, domain: text
    } as never);
    expect(task).toContain('## Доменная карта');
    const audit = architecturePrompt(prompt('architecture-audit.md'), { rules: {}, modules: [], found: [], domain: text });
    expect(audit).toContain('подтверждённый заказ');
    expect(domainText(emptyDomain())).toBe('');
  });

  it('раскладка принимает domain у карты и area у решения и собирает блок docdd-domain', () => {
    const answer = [`${FENCE}docdd-records`, JSON.stringify({ records: [
      { key: 'karta', type: 'map', title: 'Домен', domain: { contexts: [{ id: 'orders', kind: 'core' }] } },
      { key: 'baza', type: 'decision', title: 'Хранение', area: 'storage', body: '## Варианты\n\n1. Одна база.\n2. База на контекст.' }
    ] }), FENCE].join(LF);
    const parsed = parseProposal(answer);
    expect(parsed.problems).toEqual([]);
    const map = recordTemplate({ id: 'M-0001', type: 'map', title: 'Домен', today: '2026-11-11', ...(parsed.records[0]?.domain ? { domain: parsed.records[0].domain } : {}) });
    expect(parseMapRecord(map).change.domain?.added?.contexts?.[0]?.id).toBe('orders');
    const decision = recordTemplate({ id: 'A-0001', type: 'decision', title: 'Хранение', today: '2026-11-11', area: 'storage' });
    expect(decision).toContain('area: storage');
    expect(parseProposal(answer.replace('"storage"', '"cloud"')).records).toEqual([]);
  });

  it('у карты без domain блок не появляется', () => {
    expect(recordTemplate({ id: 'M-0002', type: 'map', title: 'Пусто', today: '2026-11-11', domain: { contexts: [] } })).not.toContain('docdd-domain');
  });

  it('у проекта без карты запрос на задачу без раздела', () => {
    const task = taskPrompt(prompt('task.md'), { id: 'T-1', title: 'Т', body: 'Сделать.', requirements: [], documents: [], map: '', modules: [], referenceIndex: null, practices: [], rework: '', round: 1 } as never);
    expect(task).not.toContain('## Доменная карта');
    expect(rec('M-0001', 'map', 'approved').type).toBe('map');
  });
});
