<script setup lang="ts">
defineProps<{
  title: string;
  trail: readonly { id: string; title: string }[];
  maxDepth: number;
  depth: number;
}>();
defineEmits<{ enter: [id?: string]; 'update:depth': [depth: number] }>();
const { t } = useT();
</script>

<template>
  <nav class="mb-2 flex flex-wrap items-center gap-2" :aria-label="t('mapGraph.location')">
    <span class="text-sm text-muted">{{ t('mapGraph.location') }}</span>
    <UButton v-if="trail.length" variant="link" @click="$emit('enter')">{{ title }}</UButton>
    <span v-else class="text-sm font-medium" aria-current="location">{{ title }}</span>
    <template v-for="(item, index) in trail" :key="item.id">
      <span aria-hidden="true" class="text-muted">›</span>
      <UButton v-if="index < trail.length - 1" variant="link" @click="$emit('enter', item.id)">{{ item.title }}</UButton>
      <span v-else class="text-sm font-medium" aria-current="location">{{ item.title }}</span>
    </template>
    <UBadge variant="subtle" color="neutral">{{ t('mapGraph.currentLevel', { n: trail.length + 1 }) }}</UBadge>
    <label v-if="maxDepth > 1" class="ml-2 flex items-center gap-2 text-sm">{{ t('mapGraph.visibleLevels') }}
      <select :value="depth" class="rounded border border-default bg-default px-2 py-1"
        @change="$emit('update:depth', Number(($event.target as HTMLSelectElement).value))">
        <option v-for="level in maxDepth" :key="level" :value="level">{{ level }}</option>
      </select>
    </label>
  </nav>
</template>
