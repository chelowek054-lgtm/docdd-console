<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * «Запрос на проверку» (docs/04-ui.md, «Задачи на проверке — запрос на
 * проверку»): собрать текст для основной сессии Claude Code. Сам ничего не
 * запускает — вставляет его человек.
 */
const props = defineProps<{
  projectId: string;
  /** Задачи, видимые сейчас под фильтрами: для флажка «только отфильтрованные». */
  visibleIds: string[];
  /** Сколько задач на проверке всего: ноль — кнопка недоступна. */
  total: number;
}>();

const open = ref(false);
const agents = ref(3);
// По умолчанию — столько, чтобы одна волна взяла все задачи (в пределах 20 на агента).
const perAgent = ref(Math.min(20, Math.max(1, Math.ceil((props.total || 1) / 3))));
const minutes = ref(10);
const branch = ref(`review/${new Date().toISOString().slice(0, 10)}`);
const onlyFiltered = ref(false);

const prompt = ref('');
const count = ref(0);
const building = ref(false);
const copied = ref(false);
const failure = ref<ApiFailure | null>(null);

async function build() {
  building.value = true;
  failure.value = null;
  prompt.value = '';
  try {
    const response = await $fetch<{ prompt: string; count: number } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/prompt`,
      {
        method: 'POST',
        body: {
          kind: 'review-batch',
          agents: Number(agents.value),
          perAgent: Number(perAgent.value),
          minutes: Number(minutes.value),
          branch: branch.value,
          taskIds: onlyFiltered.value ? props.visibleIds : undefined
        },
        ignoreResponseError: true
      }
    );
    if (response && typeof response === 'object' && 'error' in response) {
      failure.value = response.error;
      return;
    }
    prompt.value = response.prompt;
    count.value = response.count;
  } catch (error) {
    failure.value = { code: 'network', message: 'Не удалось собрать запрос', detail: String(error) };
  } finally {
    building.value = false;
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(prompt.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (error) {
    failure.value = { code: 'clipboard', message: 'Не удалось скопировать: выделите текст и скопируйте вручную', detail: String(error) };
  }
}
</script>

<template>
  <!-- Один корень: класс от родителя (`ml-auto`) должен лечь на обёртку. -->
  <div>
  <UButton
    icon="i-lucide-bot"
    variant="soft"
    :disabled="total === 0"
    :title="total === 0 ? 'Задач на проверке нет' : undefined"
    @click="open = true"
  >
    Запрос на проверку
  </UButton>

  <UModal v-model:open="open" title="Запрос на проверку" :description="`Задач на проверке: ${total}. Текст вставляется в основную сессию Claude Code в корне проекта.`" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="build">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UFormField label="Агентов">
            <UInput v-model.number="agents" type="number" :min="1" :max="10" class="w-full" />
          </UFormField>
          <UFormField label="Задач на агента">
            <UInput v-model.number="perAgent" type="number" :min="1" :max="20" class="w-full" />
          </UFormField>
          <UFormField label="Минут на задачу">
            <UInput v-model.number="minutes" type="number" :min="1" :max="60" class="w-full" />
          </UFormField>
        </div>
        <p class="text-sm text-muted">
          Проверяются все {{ onlyFiltered ? visibleIds.length : total }} задач: за волну — {{ agents * perAgent }},
          волн — {{ Math.max(1, Math.ceil((onlyFiltered ? visibleIds.length : total) / Math.max(1, agents * perAgent))) }}.
        </p>
        <UFormField label="Ветка проверки" hint="латиница, цифры и ._/-">
          <UInput v-model="branch" class="w-full font-mono" />
        </UFormField>
        <UCheckbox v-model="onlyFiltered" :label="`Только отфильтрованные (${visibleIds.length})`" />
        <UButton type="submit" icon="i-lucide-wand-sparkles" :loading="building">Собрать</UButton>
      </form>

      <UAlert
        v-if="failure"
        class="mt-4"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="failure.message"
        :description="failure.detail"
      />

      <div v-if="prompt" class="mt-4 space-y-2">
        <div class="flex items-center gap-3">
          <p class="text-sm text-muted">Задач в запросе: {{ count }}</p>
          <UButton class="ml-auto" size="sm" variant="soft" icon="i-lucide-copy" @click="copy">
            {{ copied ? 'Скопировано' : 'Скопировать' }}
          </UButton>
        </div>
        <textarea
          readonly
          :value="prompt"
          class="h-80 w-full resize-y rounded-md border border-default bg-elevated p-3 font-mono text-xs"
        />
      </div>
    </template>
  </UModal>
  </div>
</template>
