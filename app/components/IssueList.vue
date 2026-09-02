<script setup lang="ts">
import type { IssueDto } from '~~/server/lib/types';

/**
 * Список нарушений. Флажок у каждого: чинить будут отмеченные, а не всё, что
 * попало под фильтр (docs/04-ui.md, раздел «Нарушения»).
 */
const props = defineProps<{
  projectId: string;
  issues: IssueDto[];
  empty?: string;
  /** Отмеченные: ключ строки из `issueKey`. */
  chosen?: string[];
}>();

const emit = defineEmits<{ pick: [key: string] }>();
</script>

<template>
  <div v-if="props.issues.length === 0" class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted">
    {{ props.empty ?? 'Нарушений нет.' }}
  </div>

  <ul v-else class="divide-y divide-default rounded-lg border border-default">
    <li v-for="(issue, at) in props.issues" :key="`${issue.code}:${issue.recordId}:${at}`" class="flex gap-3 p-3">
      <button
        v-if="props.chosen"
        type="button"
        class="shrink-0 self-start pt-0.5"
        :aria-label="props.chosen.includes(issueKey(issue)) ? `Снять ${issue.code}` : `Отметить ${issue.code}`"
        @click="emit('pick', issueKey(issue))"
      >
        <UIcon
          :name="props.chosen.includes(issueKey(issue)) ? 'i-lucide-check-square' : 'i-lucide-square'"
          :class="props.chosen.includes(issueKey(issue)) ? 'text-primary' : 'text-muted'"
        />
      </button>

      <UBadge :color="severityColor(issue.severity)" variant="subtle" size="sm" class="shrink-0">
        {{ issue.code }}
      </UBadge>
      <div class="min-w-0 flex-1">
        <p class="text-sm">{{ issue.message }}</p>
        <p class="mt-1 text-xs text-muted">
          <NuxtLink
            v-if="issue.recordId"
            :to="`/projects/${props.projectId}/records/${issue.recordId}`"
            class="font-mono hover:underline"
          >{{ issue.recordId }}</NuxtLink>
          <span v-if="issue.recordId"> · </span>
          <span class="font-mono">{{ issue.path }}</span>
        </p>
      </div>
    </li>
  </ul>
</template>
