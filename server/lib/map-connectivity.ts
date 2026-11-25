import { isolatedMapNodes, type LintFinding } from './map-core';
import { foldMaps, type MapChange, type ProjectMap } from './maps';

type Node = { id: string; parent?: string | undefined };
type Edge = { from: string; to: string };

function topology(picture: ProjectMap, kind: keyof MapChange): [Node[], Edge[]] {
  switch (kind) {
    case 'functional': return [picture.functional.capabilities, picture.functional.relations];
    case 'sysdesign': return [picture.sysdesign.nodes, picture.sysdesign.relations];
    case 'domain': return [
      [
        ...(picture.domain.nodes ?? []).map((node) => ({ id: 'node:' + node.id, parent: node.parent ? 'node:' + node.parent : undefined })),
        ...picture.domain.contexts.map((node) => ({ id: 'context:' + node.id })),
        ...picture.domain.aggregates.map((node) => ({ id: 'aggregate:' + node.id, parent: node.context ? 'context:' + node.context : undefined }))
      ],
      [
        ...(picture.domain.edges ?? []).map((edge) => ({ from: 'node:' + edge.from, to: 'node:' + edge.to })),
        ...picture.domain.relations.map((edge) => ({ from: 'context:' + edge.from, to: 'context:' + edge.to }))
      ]
    ];
    case 'custom': return [
      picture.custom.nodes.map((node) => ({ id: JSON.stringify([node.map, node.id]), parent: node.parent ? JSON.stringify([node.map, node.parent]) : undefined })),
      picture.custom.relations.map((edge) => ({ from: JSON.stringify([edge.map, edge.from]), to: JSON.stringify([edge.map, edge.to]) }))
    ];
    case 'codemap': {
      const parents = new Map(picture.codemap.groups.flatMap((group) => (group.modules ?? []).map((id) => [id, group.id])));
      return [
        [...picture.codemap.groups, ...picture.codemap.modules.map(({ id }) => ({ id, parent: parents.get(id) }))],
        picture.codemap.imports
      ];
    }
    case 'dataflow': return [
      [...picture.dataflow.sources, ...picture.dataflow.flows.map(({ from }) => ({ id: from }))],
      picture.dataflow.flows
    ];
    case 'userflow': return [
      [...picture.userflow.screens, ...picture.userflow.calls.map(({ to }) => ({ id: to }))],
      [...picture.userflow.transitions, ...picture.userflow.calls]
    ];
    default: return [[], []];
  }
}

/** Records that predate the rule remain readable and can be corrected incrementally. */
export function lintMapConnectivity(picture: ProjectMap, change: MapChange): LintFinding[] {
  const baseline: MapChange = {
    functional: { added: { capabilities: picture.functional.capabilities, relations: picture.functional.relations } },
    sysdesign: { added: picture.sysdesign },
    codemap: { added: picture.codemap }, dataflow: { added: picture.dataflow }, userflow: { added: picture.userflow },
    custom: { added: picture.custom }, domain: { added: picture.domain }
  };
  const next = foldMaps([{ id: 'base', change: baseline }, { id: 'draft', change }]);
  return (Object.keys(change) as (keyof MapChange)[]).flatMap((kind) => {
    const old = isolatedMapNodes(...topology(picture, kind));
    return [...isolatedMapNodes(...topology(next, kind))].filter((id) => !old.has(id)).map((id) => ({
      severity: 'error', code: 'map_lint_field', field: 'parent', target: id,
      message: `Узел «${id}» остался без группы и связей. Укажите группу или связь с другим узлом.`
    }));
  });
}
