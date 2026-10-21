<script setup lang="ts">
import type { RecordDiff } from '~~/server/lib/record-diff';

/**
 * Разница записи на подтверждении: «было → станет» (R-0068, R-0070, R-0071).
 * Открытие разворачивает блок и ставит отметку просмотра на сервере: от неё
 * зависит строка журнала при подтверждении.
 */
const props = defineProps<{ projectId: string; recordId: string; status: string; type?: string }>();

const open = ref(false);
const diff = ref<RecordDiff | null>(null); const { t } = useT();
const error = ref('');

async function toggle() {
  open.value = !open.value;
  if (!open.value || diff.value) return;
  try {
    const answer = await $fetch<RecordDiff | { error: { message: string } }>(
      `/api/projects/${props.projectId}/records/${props.recordId}/diff`, { ignoreResponseError: true }
    );
    if ('error' in answer) { error.value = answer.error.message; return; }
    diff.value = answer; if (props.type === 'map') void loadMap();
    await $fetch(`/api/projects/${props.projectId}/records/${props.recordId}/diff/viewed`, { method: 'POST' });
  } catch (cause) {
    error.value = String(cause);
  }
}

const mark = { add: '+ ', del: '− ', same: '  ' } as const;
const tone = { add: 'bg-success/10', del: 'bg-error/10 line-through', same: 'text-muted' } as const;
const changedLines = computed(() => (diff.value?.text ?? []).filter((line) => line.kind !== 'same'));
// Карта: разница ещё и на самой схеме (T-0133, R-0069). Отказ маршрута не мешает текстовой разнице.
const mapDiff = ref<import('~~/server/lib/map-diff').MapDiff | null>(null); async function loadMap() { const answer = await $fetch<import('~~/server/lib/map-diff').MapDiff | { error: unknown }>(`/api/projects/${props.projectId}/records/${props.recordId}/map-diff`, { ignoreResponseError: true }).catch(() => null); if (answer && !('error' in answer)) mapDiff.value = answer; }
</script>

<template>
  <UCard v-if="props.status === 'review'">
    <template #header>
      <div class="flex items-center gap-3">
        <h2 class="font-medium">{{ t('rd.title') }}</h2>
        <UButton size="xs" variant="outline" color="neutral" class="ml-auto" @click="toggle">
          {{ open ? t('rd.hide') : t('rd.show') }}
        </UButton>
      </div>
    </template>

    <p v-if="!open" class="text-sm text-muted">{{ t('rd.skip') }}</p>
    <p v-else-if="error" class="text-sm text-error">{{ error }}</p>
    <p v-else-if="!diff" class="text-sm text-muted">{{ t('rd.counting') }}</p>
    <div v-else class="space-y-4 text-sm">
      <p class="text-muted">
        <template v-if="!diff.base">{{ t('rd.noBase') }}</template>
        <template v-else>{{ t('rd.was') }} <span class="font-mono">{{ diff.base.commit.slice(0, 8) }}</span>
          ({{ diff.base.reason === 'approved' ? t('rd.lastApproval') : t('rd.prevCommit') }}).</template>
      </p>
      <p v-if="diff.empty" class="text-muted">{{ t('rd.noDiff') }}</p><MapDiff v-if="mapDiff" :diff="mapDiff" />

      <section v-if="diff.vision">
        <h3 class="mb-1 font-medium">{{ t('rd.vision') }}</h3>
        <div v-for="item in diff.vision.fields.filter((f) => f.changed)" :key="item.field" class="mb-2">
          <div class="text-muted">{{ item.field }}</div>
          <div v-for="(line, i) in item.before.filter((l) => l.kind === 'del')" :key="'d' + i" :class="tone.del">{{ line.text }}</div>
          <div v-for="(line, i) in item.after.filter((l) => l.kind === 'add')" :key="'a' + i" :class="tone.add">{{ line.text }}</div>
        </div>
        <p v-if="diff.vision.touched.length" class="text-muted">
          {{ t('rd.touches') }}: {{ diff.vision.touched.map((cap) => `${cap.id} ${cap.title}`).join('; ') }}
        </p>
      </section>

      <section v-if="diff.fields.length">
        <h3 class="mb-1 font-medium">{{ t('rd.fields') }}</h3>
        <table class="w-full">
          <thead class="text-left text-muted"><tr><th>{{ t('rd.field') }}</th><th>{{ t('rd.before') }}</th><th>{{ t('rd.after') }}</th></tr></thead>
          <tbody>
            <tr v-for="field in diff.fields" :key="field.field">
              <td class="font-mono">{{ field.field }}</td><td :class="tone.del">{{ field.before }}</td><td :class="tone.add">{{ field.after }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="diff.links.length">
        <h3 class="mb-1 font-medium">{{ t('rd.links') }}</h3>
        <div v-for="link in diff.links" :key="link.sign + link.kind + link.target" class="font-mono" :class="link.sign === '+' ? tone.add : tone.del">
          {{ link.sign }} {{ link.kind }} {{ link.target }}
        </div>
      </section>

      <section v-if="changedLines.length">
        <h3 class="mb-1 font-medium">{{ t('rd.text') }}</h3>
        <pre class="overflow-x-auto whitespace-pre-wrap font-mono"><div v-for="(line, i) in diff.text" :key="i" :class="tone[line.kind]">{{ mark[line.kind] }}{{ line.text }}</div></pre>
      </section>
    </div>
  </UCard>
</template>
