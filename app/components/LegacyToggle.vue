<script setup lang="ts">
/** Переключатель «показать legacy» (A-0001): виден, только когда есть что показать. */
defineProps<{ count: number }>();
const show = defineModel<boolean>({ required: true });
const { t } = useT();
</script>

<template>
  <UCheckbox v-if="count > 0" v-model="show" :label="t('lg.show', { n: count })" />
</template>
