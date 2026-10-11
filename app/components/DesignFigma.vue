<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { plainTokens, type DesignTokens } from '~~/server/lib/design';
import { diffAgainst, figmaBlockText, parseFigmaVariables } from '~~/server/lib/design-figma';

/**
 * Импорт токенов из Figma Variables (docs/04-ui.md, «Дизайн»;
 * docs/16-design-system.md, «Токены из Figma»): человек вставляет ответ REST API
 * `variables/local`, экран показывает, что опознано, что пропущено и что
 * сменится в токенах проекта. Ничего не пишется само: блок копируется или
 * ложится черновиком записи `design`, который подтверждает человек.
 */
const props = defineProps<{ projectId: string; tokens: DesignTokens }>();

const { t } = useT();

const source = ref('');
const parseError = ref('');

const imported = computed(() => {
  parseError.value = '';
  const text = source.value.trim();
  if (text === '') return null;
  try {
    return parseFigmaVariables(JSON.parse(text), props.tokens.root?.value);
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : String(error);
    return null;
  }
});

const diff = computed(() => (imported.value ? diffAgainst(plainTokens(props.tokens), imported.value.block) : []));
const blockText = computed(() => (imported.value && imported.value.found.length > 0 ? figmaBlockText(imported.value.block) : ''));

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(blockText.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    // Буфер недоступен: блок остаётся на экране.
  }
}

const creating = ref(false);
const createdId = ref('');
const trouble = ref<ApiFailure | null>(null);

async function createDraft() {
  if (!blockText.value) return;
  creating.value = true;
  trouble.value = null;
  try {
    const response = await $fetch<{ record?: { id: string } } | { error: ApiFailure }>(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: { type: 'design', title: t('dfg.recordTitle'), body: `${t('dfg.recordLead')}\n\n${blockText.value}` },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) trouble.value = problem;
    else createdId.value = (response as { record?: { id: string } }).record?.id ?? '';
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-medium">{{ t('dfg.title') }}</h2>
      <p class="text-sm text-muted">{{ t('dfg.lead') }}</p>
    </div>

    <UFormField :label="t('dfg.input')" :hint="t('dfg.input.hint')">
      <UTextarea v-model="source" :rows="8" class="w-full font-mono" placeholder='{ "meta": { "variables": { … }, "variableCollections": { … } } }' />
    </UFormField>

    <p v-if="parseError" class="text-sm text-error">{{ t('dfg.parseError', { message: parseError }) }}</p>

    <template v-if="imported">
      <p v-for="problem in imported.problems" :key="problem" class="text-sm text-warning">{{ problem }}</p>

      <section v-if="imported.found.length" class="space-y-2">
        <h3 class="font-medium">{{ t('dfg.found') }}</h3>
        <div class="flex flex-wrap gap-2">
          <UBadge v-for="item in imported.found" :key="item.group" color="neutral" variant="subtle" size="sm">{{ item.group }} · {{ item.count }}</UBadge>
        </div>
      </section>

      <section v-if="diff.length" class="space-y-2">
        <h3 class="font-medium">{{ t('dfg.diff', { count: diff.length }) }}</h3>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[28rem] text-left text-sm">
            <thead class="text-xs text-muted">
              <tr><th class="pr-3">{{ t('dfg.col.key') }}</th><th class="pr-3">{{ t('dfg.col.before') }}</th><th>{{ t('dfg.col.after') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in diff" :key="row.key" class="border-t border-default">
                <td class="py-1.5 pr-3 font-mono text-xs">{{ row.key }}</td>
                <td class="py-1.5 pr-3 text-xs text-muted">{{ row.before ?? '—' }}</td>
                <td class="py-1.5 text-xs">{{ row.after }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p v-else-if="imported.found.length" class="text-sm text-success">{{ t('dfg.same') }}</p>

      <section v-if="imported.skipped.length" class="space-y-2">
        <h3 class="font-medium">{{ t('dfg.skipped', { count: imported.skipped.length }) }}</h3>
        <ul class="space-y-0.5 text-xs text-muted">
          <li v-for="item in imported.skipped" :key="item.name"><span class="font-mono">{{ item.name }}</span> — {{ item.reason }}</li>
        </ul>
      </section>

      <section v-if="blockText" class="space-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <h3 class="font-medium">{{ t('dfg.block') }}</h3>
          <UButton size="xs" variant="ghost" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy">{{ t('common.copy') }}</UButton>
        </div>
        <pre class="max-h-72 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ blockText }}</pre>
        <div class="flex flex-wrap items-center gap-3">
          <UButton :loading="creating" icon="i-lucide-file-plus" @click="createDraft">{{ t('dfg.create') }}</UButton>
          <NuxtLink v-if="createdId" :to="`/projects/${projectId}/records/${createdId}`" class="text-sm hover:underline">
            {{ t('dtb.created', { id: createdId }) }}
          </NuxtLink>
        </div>
        <p class="text-xs text-muted">{{ t('dfg.note') }}</p>
        <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />
      </section>
    </template>
  </div>
</template>
