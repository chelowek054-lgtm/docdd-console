// Служебный скрипт: раскладывает набор файлов-примеров. Запускается руками,
// в прогоне тестов не участвует — примеры лежат в репозитории готовыми.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = new URL('./example-project/', import.meta.url).pathname.replace(/^\//, '');

/** Перенос строки константой: в исходнике этого скрипта он читается хуже, чем нужно. */
const LF = String.fromCharCode(10);

const files = {
  'docs/development/project.yaml': `contract: docdd.workspace/1
project:
  id: fishforecast
  name: FishForecast
  description: Офлайн-первый помощник рыболова
paths:
  requirements: requirements
  design: design
  decisions: decisions
  contracts: contracts
  tasks: tasks
  phases: phases
  tests: tests
  diagrams: diagrams
  maps: maps
sources:
  code: [app/src]
roles:
  - id: architect
    name: Архитектор
policy:
  require_approved_docs_before_dev: true
  require_verification_before_done: true
  stale_in_progress_days: 14
`,

  'app/src/bite.ts': 'export const bite = 1;\n',

  'docs/development/requirements/R-0001-offline.md': fm({
    id: 'R-0001', type: 'requirement', title: 'Работа без сети', status: 'approved',
    created: '2026-07-01', updated: '2026-08-20',
    links: { verified_by: ['V-0001'] }
  }, 'Приложение открывается и считает прогноз без соединения.'),

  'docs/development/requirements/R-0002-bite-model.md': fm({
    id: 'R-0002', type: 'requirement', title: 'Модель клёва', status: 'approved',
    created: '2026-07-01', updated: '2026-07-01'
  }, 'Прогноз клёва считается по весам из документа знаний.'),

  'docs/development/requirements/R-0003-old-sync.md': fm({
    id: 'R-0003', type: 'requirement', title: 'Синхронизация между устройствами', status: 'superseded',
    created: '2026-06-01', updated: '2026-07-15'
  }, 'Отменённое требование: осталось без преемника.'),

  'docs/development/design/D-0001-architecture.md': fm({
    id: 'D-0001', type: 'design', title: 'Устройство клиента', status: 'approved',
    created: '2026-07-01', updated: '2026-08-20'
  }, 'Клиент хранит данные локально.'),

  'docs/development/design/D-0002-weights.md': fm({
    id: 'D-0002', type: 'design', title: 'Веса модели клёва', status: 'review',
    created: '2026-07-10', updated: '2026-08-01'
  }, 'Черновик весов: ещё не подтверждён.'),

  'docs/development/design/D-0003-parsing.md': fm({
    id: 'D-0003', type: 'design', title: 'Разбор данных', status: 'approved',
    created: '2026-07-10', updated: '2026-07-10'
  }, [
    'Разбор живёт в [модуле клёва](../../../app/src/bite.ts#L1-L10).',
    '',
    'Старая ссылка ведёт в [переехавший файл](../../../app/src/missing.ts).',
    '',
    'Соседний документ: [устройство клиента](./D-0001-architecture.md).'
  ].join('\n')),

  'docs/development/design/D-0009-status.md': fm({
    id: 'D-0009', type: 'design', title: 'Документ с чужим статусом', status: 'в работе',
    created: '2026-07-10', updated: '2026-07-10'
  }, 'Статус не из схемы статусов.'),

  'docs/development/design/D-9998-broken.md': '# Файл без front matter\n\nРазбор на нём и должен споткнуться.\n',

  'docs/development/decisions/A-0001-stack.md': fm({
    id: 'A-0001', type: 'decision', title: 'Стек клиента', status: 'approved',
    created: '2026-07-01', updated: '2026-07-01'
  }, 'Выбран локальный стек без сервера.'),

  'docs/development/decisions/A-0009-unknown.md': fm({
    id: 'A-0009', type: 'adr', title: 'Запись незнакомого типа', status: 'accepted',
    created: '2026-07-01', updated: '2026-07-01'
  }, 'Тип не из контракта: показываем как есть.'),

  'docs/development/contracts/C-0001-api.md': fm({
    id: 'C-0001', type: 'contract', title: 'Формат обмена', status: 'approved',
    created: '2026-07-01', updated: '2026-07-01'
  }, 'Обмен описан в openapi.yaml.'),

  'docs/development/tasks/T-0001-offline.md': fm({
    id: 'T-0001', type: 'task', change: 'feature', title: 'Сделать работу без сети', status: 'done',
    created: '2026-07-05', updated: '2026-08-25',
    links: { implements: ['R-0001'], documents: ['D-0001'], verified_by: ['V-0001'], affects: ['M-0001'] }
  }, 'Задача закрыта, проверка пройдена.'),

  'docs/development/tasks/T-0002-weights.md': fm({
    id: 'T-0002', type: 'task', change: 'fix', title: 'Вынести веса модели клёва', status: 'in_progress',
    created: '2026-07-20', updated: '2026-08-01',
    links: { implements: ['R-0001'], documents: ['D-0002'] }
  }, 'Задача в работе с неподтверждённым документом.'),

  'docs/development/tasks/T-0003-broken-link.md': fm({
    id: 'T-0003', type: 'task', change: 'fix', title: 'Задача со ссылкой в никуда', status: 'ready',
    created: '2026-07-20', updated: '2026-08-28',
    links: { implements: ['R-9999'] }
  }, 'Требования с таким номером нет.'),

  'docs/development/tasks/T-0004-cycle-a.md': fm({
    id: 'T-0004', type: 'task', change: 'fix', title: 'Первая половина цикла', status: 'backlog',
    created: '2026-07-20', updated: '2026-07-20',
    links: { depends_on: ['T-0005'] }
  }, 'Ждёт вторую половину.'),

  'docs/development/tasks/T-0005-cycle-b.md': fm({
    id: 'T-0005', type: 'task', change: 'fix', title: 'Вторая половина цикла', status: 'backlog',
    created: '2026-07-20', updated: '2026-07-20',
    links: { depends_on: ['T-0004'] }
  }, 'Ждёт первую половину.'),

  'docs/development/tasks/T-0006-unverified.md': fm({
    id: 'T-0006', type: 'task', change: 'feature', title: 'Закрыта с непройденной проверкой', status: 'done',
    created: '2026-07-20', updated: '2026-08-25',
    links: { implements: ['R-0001'], verified_by: ['V-0002'], affects: ['M-0001'] }
  }, 'Проверка в последнем отчёте не прошла.'),

  'docs/development/tasks/T-0007-doc-later.md': fm({
    id: 'T-0007', type: 'task', change: 'feature', title: 'Документ изменён после закрытия', status: 'done',
    created: '2026-07-20', updated: '2026-08-10',
    links: { implements: ['R-0001'], documents: ['D-0001'], affects: ['M-0003'] }
  }, 'Документ правился уже после закрытия задачи.'),

  'docs/development/tasks/T-0008-title.md': `---
id: T-0008
type: task
title: Заголовок в front matter
status: backlog
change: format
created: 2026-07-20
updated: 2026-07-20
links:
  implements: [R-0001]
---

# Совсем другой заголовок

Текст задачи.
`,

  'docs/development/tasks/T-0010-first.md': fm({
    id: 'T-0010', type: 'task', title: 'Первый файл с занятым номером', status: 'backlog',
    created: '2026-07-20', updated: '2026-07-20', links: {}
  }, 'Номер занят дважды.'),

  'docs/development/tasks/T-0010-second.md': fm({
    id: 'T-0010', type: 'task', title: 'Второй файл с занятым номером', status: 'backlog',
    created: '2026-07-20', updated: '2026-07-20', links: {}
  }, 'Номер занят дважды.'),

  'docs/development/tasks/R-0010-wrong-prefix.md': fm({
    id: 'R-0010', type: 'task', title: 'Задача с чужим префиксом', status: 'backlog',
    created: '2026-07-20', updated: '2026-07-20', links: {}
  }, 'Префикс не отвечает типу.'),

  'docs/development/tasks/T-0011-wrong-link.md': fm({
    id: 'T-0011', type: 'task', change: 'feature', title: 'Связь ведёт не туда', status: 'ready',
    created: '2026-07-20', updated: '2026-08-28',
    links: { implements: ['D-0001'], affects: ['M-0004'] }
  }, 'implements обязан вести на требование.'),

  'docs/development/tasks/T-0012-no-requirement.md': fm({
    id: 'T-0012', type: 'task', title: 'Готова, но без требования', status: 'ready',
    created: '2026-07-20', updated: '2026-08-28', links: {}
  }, 'Работа без требования не проверяется фактом.'),

  'docs/development/maps/M-0001-bite-module.md': mapRecord({
    id: 'M-0001', title: 'Модуль расчёта клёва', status: 'approved',
    created: '2026-07-20', updated: '2026-08-25'
  }, {
    codemap: {
      added: {
        modules: [{ id: 'app/src/bite.ts', title: 'Расчёт клёва', layer: 'ядро' }],
        imports: [{
          from: 'app/src/bite.ts', to: 'app/src/bite.ts',
          evidence: { path: 'app/src/bite.ts', line: 1, fragment: 'export const bite' }
        }]
      }
    }
  }),

  'docs/development/maps/M-0002-broken.md': mapRecord({
    id: 'M-0002', title: 'Карта с испорченным блоком', status: 'approved',
    created: '2026-07-20', updated: '2026-07-20'
  }, null),

  'docs/development/maps/M-0003-moved.md': mapRecord({
    id: 'M-0003', title: 'Карта со свидетельством в никуда', status: 'approved',
    created: '2026-07-20', updated: '2026-08-10'
  }, {
    codemap: {
      added: {
        imports: [{
          from: 'app/src/gone.ts', to: 'app/src/bite.ts',
          evidence: { path: 'app/src/gone.ts', line: 4, fragment: 'import { bite }' }
        }]
      }
    }
  }),

  'docs/development/maps/M-0005-stale.md': mapRecord({
    id: 'M-0005', title: 'Карта, из-под которой уехал код', status: 'approved',
    created: '2026-07-20', updated: '2026-08-01'
  }, {
    codemap: {
      added: {
        imports: [{
          from: 'app/src/bite.ts', to: 'app/src/bite.ts',
          evidence: { path: 'app/src/bite.ts', line: 1, fragment: 'export const weights' }
        }]
      }
    }
  }),

  'docs/development/maps/M-0006-drift.md': mapRecord({
    id: 'M-0006', title: 'Карта объявила убранным то, что на месте', status: 'approved',
    created: '2026-07-20', updated: '2026-08-01'
  }, {
    codemap: {
      removed: {
        imports: [{
          from: 'app/src/bite.ts', to: 'app/src/bite.ts',
          evidence: { path: 'app/src/bite.ts', line: 1, fragment: 'export const bite' }
        }]
      }
    }
  }),

  'docs/development/maps/M-0004-draft.md': mapRecord({
    id: 'M-0004', title: 'Черновик карты', status: 'draft',
    created: '2026-07-20', updated: '2026-07-20'
  }, {
    userflow: { added: { screens: [{ id: '/bite', title: 'Клёв' }] } }
  }),

  'docs/development/phases/P-0001-first.md': fm({
    id: 'P-0001', type: 'phase', title: 'Первая фаза', status: 'active',
    created: '2026-07-01', updated: '2026-08-01',
    links: { covers: ['T-0001', 'T-0002'] }
  }, 'Состав первой фазы.'),

  'docs/development/tests/V-0001-offline.md': fm({
    id: 'V-0001', type: 'verification', title: 'Прогон офлайн-режима', status: 'approved',
    created: '2026-07-05', updated: '2026-07-05', kind: 'unit', runner: 'npm'
  }, 'Проверяет работу без сети.'),

  'docs/development/tests/V-0002-bite.md': fm({
    id: 'V-0002', type: 'verification', title: 'Прогон модели клёва', status: 'approved',
    created: '2026-07-05', updated: '2026-07-05', kind: 'unit', runner: 'npm'
  }, 'Проверяет расчёт клёва.'),

  'docs/development/tests/V-0003-manual.md': fm({
    id: 'V-0003', type: 'verification', title: 'Ручная проверка карты', status: 'approved',
    created: '2026-07-05', updated: '2026-07-05', kind: 'manual'
  }, 'Ни разу не запускалась.'),

  'docs/development/tests/reports/2026-08-30-npm.json': JSON.stringify({
    contract: 'docdd.workspace/1',
    runner: 'npm',
    started_at: '2026-08-30T10:00:00Z',
    total: 12,
    failed: 1,
    verifications: { 'V-0001': 'passed', 'V-0002': 'failed' }
  }, null, 2) + '\n'
};

/** Запись карты: структуры блоками в теле (docs/07-maps.md). */
function mapRecord(fields, structures) {
  const { id, title, status, created, updated } = fields;
  const lines = [
    '---',
    `id: ${id}`,
    'type: map',
    `title: ${title}`,
    `status: ${status}`,
    `created: ${created}`,
    `updated: ${updated}`,
    '---',
    '',
    `# ${title}`,
    '',
    'Что меняется в устройстве и почему.',
    ''
  ];

  if (structures === null) {
    // Намеренно испорченный блок: карта, которую нельзя разобрать.
    lines.push('```docdd-codemap', '{ "added": { не json', '```', '');
  } else {
    for (const [name, value] of Object.entries(structures)) {
      lines.push('```docdd-' + name, JSON.stringify(value, null, 2), '```', '');
    }
  }
  return lines.join(LF);
}

function fm(fields, body) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'links') {
      const kinds = Object.entries(value);
      if (kinds.length === 0) {
        lines.push('links: {}');
        continue;
      }
      lines.push('links:');
      for (const [kind, ids] of kinds) lines.push(`  ${kind}: [${ids.join(', ')}]`);
      continue;
    }
    lines.push(`${key}: ${value}`);
  }
  lines.push('---', '', `# ${fields.title}`, '', body, '');
  return lines.join('\n');
}

for (const [name, content] of Object.entries(files)) {
  const target = join(root, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}
console.log(`записано файлов: ${Object.keys(files).length}`);
