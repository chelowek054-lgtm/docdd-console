// Мастер нового проекта: план записей до первой задачи (R-0076, docs/04-ui.md, «Подключение»).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { manifestYaml } from '../server/lib/scaffold';
import { bulkStatus } from '../server/utils/bulk-service';
import { createRecords } from '../server/utils/inbox-service';
import { collectOnboarding } from '../server/utils/onboarding-service';
import { checklist } from '../server/lib/onboarding';
import { glossaryText, parseFeatures, parseTerms, wizardPlan } from '../server/lib/new-project';
import { parseGlossary } from '../server/lib/glossary';

const vision = { problem: 'Команда теряется в задачах', audience: 'Команды разработки', outcome: 'Любая задача прослеживается', not: 'Не заменяет Jira' };

describe('разбор списков из полей мастера', () => {
  it('возможности: «Название — требование», маркеры и пустые строки', () => {
    expect(parseFeatures('- Вход по паролю — человек входит и видит свои проекты\n\n2) Список проектов\nОтчёты: выгрузка в PDF')).toEqual([
      { title: 'Вход по паролю', requirement: 'человек входит и видит свои проекты' },
      { title: 'Список проектов' },
      { title: 'Отчёты', requirement: 'выгрузка в PDF' }
    ]);
  });
  it('глоссарий: только строки с определением', () => {
    expect(parseTerms('Задача — единица работы\nпросто слово')).toEqual([{ term: 'Задача', definition: 'единица работы' }]);
  });
});

describe('план записей', () => {
  const plan = wizardPlan({ vision, features: parseFeatures('Вход — человек входит\nОтчёты'), phase: 'Старт' });
  const byType = (type: string) => plan.records.filter((record) => record.type === type);
  it('карта с вектором и возможностями, на каждую — требование, проверка и задача, и фаза', () => {
    expect(plan.problems).toEqual([]);
    expect(byType('map')).toHaveLength(1);
    expect(byType('map')[0]!.capabilities!.map((c) => c.title)).toEqual(['Вход', 'Отчёты']);
    expect(byType('requirement')).toHaveLength(2);
    expect(byType('verification')).toHaveLength(2);
    expect(byType('task')).toHaveLength(2);
    expect(byType('phase')[0]).toMatchObject({ title: 'Старт' });
  });
  it('связи — по ключам: задача реализует требование, проверяется проверкой и меняет карту; фаза покрывает задачи', () => {
    expect(byType('task')[0]!.links).toEqual({ implements: ['r1'], verified_by: ['v1'], affects: ['map'] });
    expect(byType('verification')[0]!.links).toEqual({ verifies: ['r1'] });
    expect(byType('phase')[0]!.links).toEqual({ covers: ['t1', 't2'] });
    expect(byType('task').every((task) => task.change === 'feature' && task.reuse === 'none')).toBe(true);
  });
  it('ключи уникальны, повтор названия не затирает соседа', () => {
    const twin = wizardPlan({ vision, features: [{ title: 'Отчёт' }, { title: 'Отчёт' }] });
    const ids = twin.records[0]!.capabilities!.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
    expect(new Set(twin.records.map((r) => r.key)).size).toBe(twin.records.length);
  });
  it('требование — из названия, когда не названо; проверка — с шагами и ожидаемым результатом', () => {
    expect(byType('requirement')[1]!.title).toBe('Отчёты');
    expect(byType('verification')[0]!.body).toContain('## Шаги');
    expect(byType('verification')[0]!.kind).toBe('manual');
  });
  it('без проблемы и без возможностей мастер отказывает словами', () => {
    expect(wizardPlan({ vision: { ...vision, problem: '' }, features: [{ title: 'А' }] }).problems[0]).toMatch(/проблем/);
    expect(wizardPlan({ vision, features: [] }).problems[0]).toMatch(/возможност/);
  });
});

describe('глоссарий', () => {
  it('текст читается тем же разбором, что экран «Глоссарий»', () => {
    const terms = parseGlossary(glossaryText([{ term: 'Задача', definition: 'единица работы' }], 'Демо'));
    expect(terms).toEqual([{ term: 'Задача', definition: 'единица работы' }]);
  });
  it('без терминов — пример формата, который тоже разбирается', () => {
    expect(parseGlossary(glossaryText([], 'Демо')).map((t) => t.term)).toEqual(['Пример']);
  });
});

describe('мастер до первой задачи «готова к работе» — на настоящем проекте', () => {
  it('черновики → подтверждение → задачи ready, без ручной правки файлов; чек-лист это видит', () => {
    const root = mkdtempSync(join(tmpdir(), 'docdd-wz-'));
    try {
      mkdirSync(join(root, 'docs', 'development'), { recursive: true });
      writeFileSync(join(root, 'docs', 'development', 'project.yaml'), manifestYaml({ id: 'wz', name: 'Wz' }), 'utf8');
      expect(checklist(collectOnboarding(root)).every((step) => step.status === 'not_started')).toBe(true);

      const plan = wizardPlan({ vision, features: parseFeatures('Вход — человек входит\nСписок проектов'), phase: 'Старт' });
      const made = createRecords(root, plan.records, []);
      expect(made.ok).toBe(true);
      if (!made.ok) return;
      const ids = (...types: string[]) => made.created.filter((item) => types.includes(item.type)).map((item) => item.id);

      const approved = bulkStatus(root, ids('map', 'requirement', 'verification'), 'approve', 'architect');
      expect(approved.results.every((row) => row.ok)).toBe(true);
      const ready = bulkStatus(root, ids('task'), 'forward', 'architect');
      expect(ready.results.map((row) => row.to)).toEqual(['ready', 'ready']);

      const state = collectOnboarding(root);
      expect(state).toMatchObject({ vision: 'approved', capabilities: 2, requirements: 2, requirementsChecked: 2 });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
