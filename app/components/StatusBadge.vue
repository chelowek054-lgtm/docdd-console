<script setup lang="ts">
const props = defineProps<{ status: string }>();
</script>

<template>
  <UBadge :color="statusColor(props.status)" variant="subtle" size="sm">
    {{ statusLabel(props.status) }}
  </UBadge>
</template>
