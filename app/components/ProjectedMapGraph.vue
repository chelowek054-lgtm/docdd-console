<script setup lang="ts">
import type { MermaidEdge, MermaidOutput } from '~/utils/map-mermaid';

const props = defineProps<{ graph: MermaidOutput; template: string; viewId: string }>();
const emit = defineEmits<{ select: [id: string]; open: [id: string]; relation: [edge: MermaidEdge]; clear: [] }>();
const nodes = computed(() => {
  const ids = new Set(Object.keys(props.graph.nodes));
  for (const edge of props.graph.edges) {
    ids.add(edge.from);
    ids.add(edge.to);
  }
  return [...ids].map((id) => {
    const node = props.graph.nodes[id];
    return {
      id,
      title: node?.title ?? node?.id ?? props.graph.details[id] ?? id,
      ...(node?.summary ? { summary: node.summary } : {}),
      ...(props.template === 'codebase' && node?.group ? { kind: 'group' } : {})
    };
  });
});
const edges = computed(() => props.graph.edges.map((edge, index) => ({
  from: edge.from, to: edge.to, type: String(index),
  summary: edge.link ? String(edge.link.imports.length) : edge.evidence.fragment
})));
const indicators = computed(() => Object.fromEntries(Object.entries(props.graph.nodes).map(([id, node]) => [id, {
  muted: Boolean(node.ghost || node.pending),
  ...(node.group ? {
    children: node.group.moduleCount,
    incoming: node.group.usedBy.reduce((sum, edge) => sum + edge.count, 0),
    outgoing: node.group.dependsOn.reduce((sum, edge) => sum + edge.count, 0)
  } : {})
}])));
function onRelation(_from: string, _to: string, index?: string) {
  const edge = props.graph.edges[Number(index)];
  if (edge) emit('relation', edge);
}
</script>

<template>
  <LazyStandardMapGraph projected :template="template" :nodes="nodes" :edges="edges" :view-id="viewId" :indicators="indicators"
    @select="emit('select', $event)" @open="emit('open', $event)"
    @relation="onRelation" @clear="emit('clear')" />
</template>
