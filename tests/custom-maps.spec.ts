import { describe, expect, it } from 'vitest';

import { customDefinitions, defaultCustomRelations } from '../server/lib/custom-maps';

/** R-0042 / ADR-0028: определения пользовательских карт из maps.custom. */

const ok = { id: 'godot-client', title: 'Клиент Godot', node: { label: 'Подсистема', plural: 'Подсистемы' } };
const run = (custom: unknown) => customDefinitions({ maps: { custom } } as never);

describe('customDefinitions', () => {
  it('нет секции — нет карт и нет бед', () => {
    expect(customDefinitions({} as never)).toEqual({ definitions: [], problems: [] });
  });

  it('годное определение: виды связей по умолчанию, features пусты, чужие поля сохранены', () => {
    const { definitions, problems } = run([{ ...ok, extra: 1 }]);
    expect(problems).toEqual([]);
    expect(definitions).toHaveLength(1);
    expect(definitions[0]!.relations).toEqual(defaultCustomRelations());
    expect(definitions[0]!.features).toEqual([]);
    expect((definitions[0] as Record<string, unknown>)['extra']).toBe(1);
  });

  it('features без повторов; неизвестная возможность — беда карты', () => {
    expect(run([{ ...ok, features: ['status', 'status', 'links'] }]).definitions[0]!.features).toEqual(['status', 'links']);
    const bad = run([{ ...ok, features: ['magic'] }]);
    expect(bad.definitions).toEqual([]);
    expect(bad.problems.join(' ')).toContain('magic');
  });

  it('беда одной карты не роняет остальные; повтор id отклоняется', () => {
    const { definitions, problems } = run([{ ...ok, id: 'bad id' }, ok, { ...ok, title: 'Второй' }]);
    expect(definitions.map((d) => d.id)).toEqual(['godot-client']);
    expect(problems).toHaveLength(2);
  });

  it('вид связи со стилем вне пяти и повтор id вида отклоняются', () => {
    expect(run([{ ...ok, relations: [{ id: 'x', label: 'x', style: 'nope' }] }]).definitions).toEqual([]);
    const dup = { id: 'depends', label: 'a', style: 'depends' };
    expect(run([{ ...ok, relations: [dup, dup] }]).definitions).toEqual([]);
  });

  it('не список, не объект, пустое название, нет node — отказ с пояснением', () => {
    expect(run({}).problems).toHaveLength(1);
    expect(run(['x']).problems).toHaveLength(1);
    expect(run([{ ...ok, title: ' ' }]).definitions).toEqual([]);
    expect(run([{ id: 'a', title: 'A' }]).definitions).toEqual([]);
  });
});
