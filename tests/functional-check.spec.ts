import { describe, expect, it } from 'vitest';

import { parseFunctionalCheck } from '../server/lib/functional-check';
import { CAPABILITIES_TREE_MARKER, functionalCheckPrompt } from '../server/lib/prompt';

/**
 * Разбор ответа «Проверить по коду» (docs/07-maps.md): мнение модели
 * превращается в таблицу предложений, но ничего не применяет само.
 */

const CAPS = [
  { id: 'orders', title: 'Заказы' },
  { id: 'orders.pay', title: 'Оплата', parent: 'orders', status: 'partial' },
  { id: 'orders.refund', title: 'Возврат', parent: 'orders' },
  { id: 'login', title: 'Вход', status: 'implemented' }
];

function answer(payload: unknown, before = 'Смотрел сервер и экраны.'): string {
  return [before, '', '```docdd-functional-check', JSON.stringify(payload, null, 2), '```', ''].join('\n');
}

describe('parseFunctionalCheck', () => {
  it('предложение несёт прежнюю отметку, предложенную и note', () => {
    const result = parseFunctionalCheck(answer({
      capabilities: [
        { id: 'orders.pay', status: 'implemented', note: '  возврат тоже есть  ' },
        { id: 'orders.refund', status: 'not_implemented', note: 'нет ни экрана, ни обработчика' }
      ]
    }), CAPS);

    expect(result).toEqual({
      ok: true,
      problems: [],
      proposals: [
        { id: 'orders.pay', title: 'Оплата', current: 'partial', proposed: 'implemented', note: 'возврат тоже есть' },
        { id: 'orders.refund', title: 'Возврат', current: null, proposed: 'not_implemented', note: 'нет ни экрана, ни обработчика' }
      ]
    });
  });

  it('пропуск — тоже ответ: возможность, которой нет в блоке, в таблицу не попадает', () => {
    const result = parseFunctionalCheck(answer({ capabilities: [{ id: 'login', status: 'implemented' }] }), CAPS);
    expect(result.ok && result.proposals.map((item) => item.id)).toEqual(['login']);
  });

  it('родитель не оценивается: его состояние считается по нижним', () => {
    const result = parseFunctionalCheck(answer({ capabilities: [{ id: 'orders', status: 'implemented' }] }), CAPS);
    expect(result.ok && result.proposals).toEqual([]);
    expect(result.ok && result.problems[0]).toContain('подпункты');
  });

  it('неизвестный id, недопустимое состояние и запись без id называются и не применяются', () => {
    const result = parseFunctionalCheck(answer({
      capabilities: [
        { id: 'нет-такой', status: 'implemented' },
        { id: 'login', status: 'done' },
        { status: 'partial' },
        { id: 'orders.pay', status: 'partial' }
      ]
    }), CAPS);

    expect(result.ok && result.proposals.map((item) => item.id)).toEqual(['orders.pay']);
    const problems = result.ok ? result.problems.join('\n') : '';
    expect(problems).toContain('`нет-такой`: нет в карте');
    expect(problems).toContain('недопустимое состояние `done`');
    expect(problems).toContain('Запись №3: нет `id`');
  });

  it('повтор id в ответе — уточнение: побеждает последний', () => {
    const result = parseFunctionalCheck(answer({
      capabilities: [
        { id: 'login', status: 'partial' },
        { id: 'login', status: 'not_implemented', note: 'передумал' }
      ]
    }), CAPS);
    expect(result.ok && result.proposals).toEqual([
      { id: 'login', title: 'Вход', current: 'implemented', proposed: 'not_implemented', note: 'передумал' }
    ]);
  });

  it('нет блока, битый JSON или нет списка — отказ с причиной, а не пустая таблица', () => {
    expect(parseFunctionalCheck('просто текст', CAPS)).toMatchObject({ ok: false });
    expect(parseFunctionalCheck('```docdd-functional-check\n{ не json\n```', CAPS)).toMatchObject({ ok: false });
    expect(parseFunctionalCheck(answer({ items: [] }), CAPS)).toMatchObject({ ok: false });
  });

  it('блок пустым списком — не отказ: модель всё пропустила', () => {
    expect(parseFunctionalCheck(answer({ capabilities: [] }), CAPS)).toEqual({ ok: true, proposals: [], problems: [] });
  });
});

describe('functionalCheckPrompt: текущая отметка', () => {
  const template = ['---', CAPABILITIES_TREE_MARKER].join('\n');

  it('у нижней возможности показана отметка и note, у неоценённой — «не оценена»', () => {
    const prompt = functionalCheckPrompt(template, [
      { id: 'orders', title: 'Заказы' },
      { id: 'orders.pay', title: 'Оплата', parent: 'orders', status: 'partial', note: 'возврата нет' },
      { id: 'orders.refund', title: 'Возврат', parent: 'orders' }
    ]);
    expect(prompt).toContain('- `orders.pay` — Оплата [сейчас: частично — возврата нет]');
    expect(prompt).toContain('- `orders.refund` — Возврат [сейчас: не оценена]');
  });

  it('у родителя отметки нет: ответ ему модель не подсказывают', () => {
    const prompt = functionalCheckPrompt(template, [
      { id: 'orders', title: 'Заказы', status: 'implemented' },
      { id: 'orders.pay', title: 'Оплата', parent: 'orders' }
    ]);
    expect(prompt).toContain('- `orders` — Заказы\n');
    expect(prompt).not.toContain('Заказы [сейчас');
  });
});
