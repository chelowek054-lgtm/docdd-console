import { editorDraft, type FlowCapability, type FlowRelation } from './map-flow';

export type EditableMapTemplate = 'strategic' | 'domain' | 'sysdesign';

export function visualMapDraft(
  template: EditableMapTemplate,
  nodes: readonly FlowCapability[],
  links: readonly FlowRelation[],
  removedNodes: readonly string[],
  removedLinks: readonly FlowRelation[]
) {
  if (template === 'strategic') return editorDraft(nodes, links, removedNodes, removedLinks);
  const mapNode = (node: FlowCapability) => {
    const { summary, ...rest } = node;
    return template === 'domain' ? node : {
      detail: 'template', realized_by: [], ...rest, ...(summary !== undefined ? { reference: summary } : {})
    };
  };
  function part(items: unknown[], relations: readonly FlowRelation[]) {
    const edges = relations.map(({ from, to, type, summary }) => template === 'domain'
      ? { from, to, type, ...(summary ? { summary } : {}) }
      : { from, to, kind: type, ...(summary ? { label: summary } : {}) });
    return { ...(items.length ? { nodes: items } : {}),
      ...(edges.length ? { [template === 'domain' ? 'edges' : 'relations']: edges } : {}) };
  }
  const body = {
    ...(nodes.length || links.length ? { added: part(nodes.map(mapNode), links) } : {}),
    ...(removedNodes.length || removedLinks.length ? { removed: part(removedNodes.map((id) => ({ id })), removedLinks) } : {})
  };
  const fence = '```';
  return [fence + 'docdd-' + template, JSON.stringify(body, null, 2), fence].join('\n');
}
