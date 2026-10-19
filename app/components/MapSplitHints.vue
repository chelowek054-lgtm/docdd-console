<script setup lang="ts">
// Подсказки дробления группы (ADR-0027): слишком много детей, слабая связность,
// цикл. Это совет, а не запрет; тексты и условия считает hierarchy.ts.
import { splitHints, splitHintTexts, type Edge, type TreeNode } from '~~/server/lib/hierarchy';

const props = defineProps<{ groupId: string; nodes: TreeNode[]; edges: Edge[] }>();

const texts = computed(() => {
  const codes = splitHints(props.groupId, props.nodes, props.edges);
  if (!codes.length) return [];
  const children = props.nodes.filter((n) => n.parent === props.groupId).length;
  return splitHintTexts(codes, { title: props.groupId, children });
});
</script>

<template>
  <UAlert
    v-if="texts.length"
    color="warning"
    variant="subtle"
    icon="i-lucide-split"
    title="Группу стоит раздробить"
    data-test="map-split-hints"
  >
    <template #description>
      <ul class="list-disc pl-4">
        <li v-for="text in texts" :key="text">{{ text }}</li>
      </ul>
    </template>
  </UAlert>
</template>
