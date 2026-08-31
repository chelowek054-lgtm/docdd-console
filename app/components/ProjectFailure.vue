<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

const props = defineProps<{ failure: ApiFailure }>();
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    :title="props.failure.message"
    :description="props.failure.detail"
  />
</template>
