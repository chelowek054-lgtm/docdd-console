import { describe, expect, it } from 'vitest';
import { domainFindings, domainText, profileUses } from '../server/lib/domain-map';
import { lintDomainChange, standardFor } from '../server/lib/map-core';
import { foldMaps, parseMapRecord } from '../server/lib/maps';

const nodes = [
  { id: 'paid', title: 'Оплата получена', kind: 'event', summary: 'Оплата подтверждена банком' },
  { id: 'limit', title: 'Лимит заказа', kind: 'rule', summary: 'Ограничивает выдачу' },
  { id: 'issue', title: 'Выдача', kind: 'process', summary: 'Передача заказа' }
];
const edges = [
  { from: 'paid', to: 'limit', type: 'causes' },
  { from: 'limit', to: 'issue', type: 'constrains', summary: 'Только оплаченные заказы' }
];
const change = { added: { nodes, edges } };
const standard = standardFor('domain')!.standard;

describe('доменная карта предметной области', () => {
  it('читает запись проекта без DDD, складывает узлы и связи и передаёт их в контекст модели', () => {
    const parsed = parseMapRecord(['```docdd-domain', JSON.stringify(change), '```'].join('\n'));
    expect(parsed.problems).toEqual([]);
    const domain = foldMaps([{ id: 'M-0001', change: parsed.change }]).domain;
    expect(domain.edges).toHaveLength(2);
    expect(domainText(domain)).toContain('limit → issue');
    expect(lintDomainChange(change, {}, standard)).toEqual([]);
    expect(domainFindings({ domain, hasCode: true, capabilities: [], modules: [], decisions: [] })).toEqual([]);
    expect(lintDomainChange({ removed: { nodes: [{ id: 'limit' }] } }, domain, standard))
      .toContainEqual(expect.objectContaining({ code: 'map_lint_dangling' }));
  });

  it('ограничивает проверку принадлежности модуля выбранным профилем', () => {
    const domain = { nodes, contexts: [{ id: 'orders', root: 'src/orders' }], aggregates: [], relations: [] };
    const input = { domain, hasCode: true, capabilities: [], modules: [{ id: 'src/outside/index.ts' }], decisions: [] };
    expect(profileUses(domain, 'fsd')).toEqual([]);
    expect(domainFindings({ ...input, profile: 'fsd' })).toEqual([]);
    expect(domainFindings({ ...input, profile: 'ddd-clean' })).toContainEqual(expect.objectContaining({ code: 'domain_module_orphan' }));
  });
});
