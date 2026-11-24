import { standardFor } from '../../server/lib/map-core';
import type { DomainState } from '../../server/lib/domain-map';
import type { FlowCapability, FlowRelation } from './map-flow';

export function domainGraph(domain: DomainState) {
  const standard = standardFor('domain')!.standard;
  const edgeTitles = new Map(standard.edgeKinds.map((kind) => [kind.id, kind.title]));
  const nodes: FlowCapability[] = (domain.nodes ?? []).map((node) => ({ ...node, id: 'node:' + node.id, ...(node.parent ? { parent: 'node:' + node.parent } : {}) }));
  const edges: FlowRelation[] = (domain.edges ?? []).map((edge) => {
    const kind = edgeTitles.get(edge.type) ?? edge.type;
    return { ...edge, from: 'node:' + edge.from, to: 'node:' + edge.to, summary: edge.summary ? kind + ' · ' + edge.summary : kind };
  });
  for (const context of domain.contexts) {
    nodes.push({ ...context, id: 'context:' + context.id, title: context.title ?? context.id, kind: 'context' });
  }
  for (const aggregate of domain.aggregates) {
    nodes.push({ id: 'aggregate:' + aggregate.id, title: aggregate.title ?? aggregate.id, kind: 'aggregate', ...(aggregate.context ? { parent: 'context:' + aggregate.context } : {}) });
    if (aggregate.context) edges.push({ from: 'context:' + aggregate.context, to: 'aggregate:' + aggregate.id, type: 'owns' });
  }
  for (const relation of domain.relations) {
    const label = relation.summary ? relation.kind + ' · ' + relation.summary : relation.kind;
    edges.push({ from: 'context:' + relation.from, to: 'context:' + relation.to, type: relation.kind, summary: label });
  }
  return { nodes, edges };
}
