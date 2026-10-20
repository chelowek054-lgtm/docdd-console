<script setup lang="ts">
import { orderDiff, type OrderGroup } from '~~/server/lib/order-diff';

/**
 * Общий вид «было → станет» (R-0072): фаза и задача со стрелкой и номерами места. Подключение:
 * `<OrderDiff :before="[{ id, items }]" :after="[{ id, items }]" :titles="{ id: название }" />`;
 * задачи, у которых «было» нет (новая фаза, пул «без фазы»), помечены «новое».
 */
const props = defineProps<{ before: OrderGroup[]; after: OrderGroup[]; titles?: Record<string, string> }>();

const result = computed(() => orderDiff(props.before, props.after));
const title = (id: string) => props.titles?.[id] ?? '';
const place = (value: number | null) => (value === null ? 'новое' : `№${value}`);
</script>

<template>
  <div class="space-y-2">
    <p class="text-xs text-muted">Переехало фаз: {{ result.movedGroups }}, задач: {{ result.movedItems }}</p>
    <ol class="space-y-2">
      <li v-for="group in result.groups" :key="group.id" class="ds-card p-3">
        <p class="text-sm font-medium">
          <span class="font-mono text-xs">{{ group.id }}</span> {{ title(group.id) }}
          <span :class="group.moved ? 'text-warning' : 'text-muted'" class="text-xs"> · {{ place(group.fromPlace) }} → №{{ group.toPlace }}</span>
        </p>
        <ul class="mt-1 space-y-0.5 text-sm">
          <li v-for="row in group.rows" :key="row.id" class="flex flex-wrap gap-2" :class="row.moved ? '' : 'text-muted'">
            <span class="font-mono text-xs">{{ row.id }}</span>
            <span class="min-w-0 flex-1">{{ title(row.id) }}</span>
            <span class="font-mono text-xs" :class="row.moved ? 'text-warning' : ''">
              {{ place(row.from) }} → №{{ row.to }}<template v-if="row.fromGroup"> (из {{ row.fromGroup }})</template>
            </span>
          </li>
          <li v-for="id in group.left" :key="`left-${id}`" class="flex gap-2 text-error line-through">
            <span class="font-mono text-xs">{{ id }}</span><span class="text-xs no-underline">ушла из фазы</span>
          </li>
        </ul>
      </li>
    </ol>
  </div>
</template>
