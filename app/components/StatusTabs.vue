<script setup lang="ts">
/**
 * Вкладки статусов над списком с числами (docs/04-ui.md, «Списки по
 * статусам»). Показываются только статусы, которые в списке есть: вкладка с
 * нулём ничего не отвечает.
 */
const props = defineProps<{
  /** Статусы всех записей списка — до фильтра по статусу. */
  statuses: string[];
  order: string[];
}>();

const model = defineModel<string>({ required: true });

const items = computed(() => {
  const counts = new Map<string, number>();
  for (const status of props.statuses) counts.set(status, (counts.get(status) ?? 0) + 1);

  const rank = (status: string) => {
    const at = props.order.indexOf(status);
    return at === -1 ? props.order.length : at;
  };
  const present = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return [
    { label: `Все · ${props.statuses.length}`, value: 'all' },
    ...present.map((status) => ({ label: `${statusLabel(status)} · ${counts.get(status)}`, value: status }))
  ];
});

const active = computed({
  get: () => model.value || 'all',
  set: (value: string | number) => { model.value = value === 'all' ? '' : String(value); }
});
</script>

<template>
  <UTabs v-model="active" :items="items" :content="false" size="sm" />
</template>
