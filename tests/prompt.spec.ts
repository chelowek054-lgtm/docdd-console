import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES_TREE_MARKER, GROUPS_MARKER, GROUP_MODULES_MARKER, functionalCheckPrompt, groupsPrompt
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
  const marked = ['# Заголовок', 'Шапка для человека.', '---', '## Группы', GROUPS_MARKER, '## Модули', GROUP_MODULES_MARKER].join(LF);

  it('модули — списком с путём (если он не равен id), слоем и названием', () => {
    const prompt = groupsPrompt(marked, [
      { id: 'server/lib/a.ts', title: 'Разбор', layer: 'ядро' },
      { id: 'maps-core', path: 'server/lib/maps.ts', title: 'Карты' }
    ], []);
    expect(prompt).toContain('- `server/lib/a.ts` [ядро] — Разбор');
    expect(prompt).toContain('- `maps-core` (`server/lib/maps.ts`) — Карты');
    expect(prompt).not.toContain('Шапка для человека');
    expect(prompt).not.toContain(GROUP_MODULES_MARKER);
  });

  it('объявленные группы называются, чтобы модель не предлагала их второй раз', () => {
    const prompt = groupsPrompt(marked, [{ id: 'x' }], [
      { id: 'graph', title: 'Граф знаний', paths: ['server/lib/graph/'], modules: ['a', 'b'] }
    ]);
    expect(prompt).toContain('- `graph` — Граф знаний, paths: `server/lib/graph/`, modules: 2');
    expect(prompt).not.toContain(GROUPS_MARKER);
  });

  it('групп нет — говорит об этом словами, а не пустой строкой', () => {
    expect(groupsPrompt(marked, [{ id: 'x' }], [])).toContain('Объявленных групп пока нет.');
  });
});
