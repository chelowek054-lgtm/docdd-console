import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES_TREE_MARKER,
  GROUPS_MARKER,
  GROUP_MODULES_MARKER,
  functionalCheckPrompt,
  groupsPrompt
} from '../server/lib/prompt';

const LF = String.fromCharCode(10);
const template = ['# Заголовок', 'Шапка для человека.', '---', '## Карта', '', CAPABILITIES_TREE_MARKER].join(LF);

describe('functionalCheckPrompt', () => {
  it('пишет дерево с отступом по глубине, а не плоским списком', () => {
    const prompt = functionalCheckPrompt(template, [
      { id: 'orders', title: 'Заказы' },
      { id: 'orders.pay', title: 'Оплата', parent: 'orders' },
      { id: 'orders.pay.card', title: 'Картой', parent: 'orders.pay' }
    ]);

    expect(prompt).toContain('- `orders` — Заказы');
    expect(prompt).toContain('  - `orders.pay` — Оплата');
    expect(prompt).toContain('    - `orders.pay.card` — Картой');
    expect(prompt).not.toContain(CAPABILITIES_TREE_MARKER);
  });

  it('шапку для человека (до ---) в запрос не кладёт', () => {
    const prompt = functionalCheckPrompt(template, [{ id: 'x' }]);
    expect(prompt).not.toContain('Шапка для человека');
  });

  it('возможностей нет — говорит об этом словами, а не пустой строкой', () => {
    const prompt = functionalCheckPrompt(template, []);
    expect(prompt).toContain('Возможностей в карте пока нет.');
  });

  it('цикл в parent не зависает — глубина обрывается на повторе, а не бесконечна', () => {
    // a → b → a: подсчёт глубины замечает повтор id и останавливается, а не
    // уходит в бесконечную рекурсию — сама глубина здесь не важна.
    const prompt = functionalCheckPrompt(template, [
      { id: 'a', parent: 'b' },
      { id: 'b', parent: 'a' }
    ]);
    expect(prompt).toContain('`a`');
    expect(prompt).toContain('`b`');
  });
});

describe('groupsPrompt', () => {
  const groupsTemplate = ['# Заголовок', 'Шапка для человека.', '---', '## Группы', GROUPS_MARKER, '## Модули', GROUP_MODULES_MARKER].join(LF);

  it('подставляет модули с путём, слоем и описанием; путь, равный id, не повторяет', () => {
    const prompt = groupsPrompt(groupsTemplate, [
      { id: 'server/lib/maps.ts', path: 'server/lib/maps.ts', layer: 'ядро', summary: 'Сверка\nкарт.' },
      { id: 'gastro.catalog', path: 'gastro/catalog/__init__.py' },
      { id: 'pandas' }
    ], []);
    expect(prompt).toContain('- `server/lib/maps.ts` — слой: ядро; Сверка карт.');
    expect(prompt).toContain('- `gastro.catalog` — путь: gastro/catalog/__init__.py');
    expect(prompt).toContain('- `pandas`');
    expect(prompt).not.toContain(GROUPS_MARKER);
    expect(prompt).not.toContain(GROUP_MODULES_MARKER);
    expect(prompt).not.toContain('Шапка для человека');
  });

  it('уже объявленные группы названы, чтобы модель их не повторяла', () => {
    const prompt = groupsPrompt(groupsTemplate, [{ id: 'a' }], [
      { id: 'knowledge', title: 'Граф знаний', paths: ['server/lib/graph', 'server/lib/links'] }
    ]);
    expect(prompt).toContain('- `knowledge` — Граф знаний; каталоги: server/lib/graph, server/lib/links');
  });

  it('групп нет — так и сказано, а не пустая строка', () => {
    expect(groupsPrompt(groupsTemplate, [{ id: 'a' }], [])).toContain('Групп пока не объявлено');
  });

  it('длинное описание обрезается, а «$&» в имени модуля не ломает подстановку', () => {
    const prompt = groupsPrompt(groupsTemplate, [{ id: 'app/$&/x.vue', summary: 'Ж'.repeat(500) }], []);
    expect(prompt).toContain('app/$&/x.vue');
    expect((prompt.match(/Ж+/) ?? [''])[0]).toHaveLength(160);
  });
});
