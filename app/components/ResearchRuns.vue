<script setup lang="ts">
import type { verificationRuns } from '~~/server/lib/industry-maps';
defineProps<{ runs: ReturnType<typeof verificationRuns> }>();
</script>

<template>
  <ul v-if="runs.length" class="space-y-2 text-sm">
    <li v-for="(run, index) in runs" :key="index">
      <code>{{ run.id }} · {{ run.run }}</code> · {{ run.result }}
      <p v-if="run.note" class="text-muted">{{ run.note }}</p>
      <ul v-if="run.measurements.length" class="list-disc ps-5">
        <li v-for="(metric, metricIndex) in run.measurements" :key="metricIndex">{{ metric.name }} · {{ metric.value }} {{ metric.unit }}</li>
      </ul>
    </li>
  </ul>
</template>
