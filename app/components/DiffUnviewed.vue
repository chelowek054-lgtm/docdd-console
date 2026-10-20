<script setup lang="ts">
/** Значок «разница не открывалась» в списке на подтверждении (R-0068). Список id общий на проект. */
const props = defineProps<{ projectId: string; recordId: string; status: string }>();

const ids = useState<Record<string, string[]>>('diff-unviewed', () => ({}));

onMounted(async () => {
  if (props.status !== 'review' || ids.value[props.projectId]) return;
  // Пустой список ставим сразу: сотня значков не должна дать сотню запросов.
  ids.value = { ...ids.value, [props.projectId]: [] };
  try {
    const answer = await $fetch<{ ids?: string[] }>(`/api/projects/${props.projectId}/diff-unviewed`, { ignoreResponseError: true });
    ids.value = { ...ids.value, [props.projectId]: answer.ids ?? [] };
  } catch {
    // Значок вспомогательный: без него список остаётся рабочим.
  }
});
</script>

<template>
  <UBadge v-if="props.status === 'review' && ids[props.projectId]?.includes(props.recordId)" color="warning" variant="subtle" size="sm" class="ml-2">
    разница не открывалась
  </UBadge>
</template>
