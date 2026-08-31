<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Запрос к модели: показать, скопировать, отправить. Отправка идёт через Claude
 * Code на этой же машине, и ответ ничего не меняет сам — он показывается
 * человеку (docs/adr/0008-llm-through-claude-code.md).
 */
const props = defineProps<{
  projectId: string;
  kind: 'fix' | 'maps';
  /** Отбор для запроса `fix`: те же фильтры, что на экране. */
  codes?: string[];
  severity?: string;
  label: string;
  hint: string;
}>();

const emit = defineEmits<{ answered: [answer: string] }>();

const open = ref(false);
const prompt = ref('');
const count = ref(0);
const building = ref(false);
const answer = ref('');
const copied = ref(false);
const failure = ref<ApiFailure | null>(null);

const { data: llm } = useFetch<{
  available: boolean;
  reason: string | null;
  timeouts: { ask: number; work: number };
}>('/api/llm', { key: 'llm' });

// Ожидание с counterом и отменой — одно на все места, откуда зовут модель.
const { running: asking, elapsed, outcome, run: runAsk, cancel: cancelAsk } = useModelRequest();

async function build() {
  open.value = true;
  building.value = true;
  failure.value = null;
  answer.value = '';
  try {
    const response = await $fetch<{ prompt: string; count: number } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/prompt`,
      {
        method: 'POST',
        body: { kind: props.kind, codes: props.codes, severity: props.severity },
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const built = response as { prompt: string; count: number };
    prompt.value = built.prompt;
    count.value = built.count;
  } finally {
    building.value = false;
  }
}

async function copy() {
  await navigator.clipboard.writeText(prompt.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

async function send() {
  failure.value = null;
  answer.value = '';
  const result = await runAsk((signal) =>
    $fetch<{ answer: string } | { error: ApiFailure }>('/api/llm/ask', {
      method: 'POST',
      // Проект называем идентификатором: путь к нему сервер знает сам.
      body: { prompt: prompt.value, projectId: props.projectId },
      ignoreResponseError: true,
      // Отмена доходит до сервера: он снимет запущенную программу.
      signal
    })
  );
  if (!result) return;

  answer.value = result.answer;
  emit('answered', answer.value);
}
</script>

<template>
  <div>
    <UButton size="sm" variant="soft" icon="i-lucide-wand-sparkles" :loading="building" @click="build">
      {{ props.label }}
    </UButton>

    <UCard v-if="open" class="mt-3">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="font-medium">Запрос к модели</h2>
          <p class="text-sm text-muted">{{ props.hint }}</p>
          <UButton
            class="ml-auto"
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            aria-label="Закрыть"
            @click="open = false"
          />
        </div>
      </template>

      <UAlert
        v-if="failure"
        class="mb-3"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="failure.message"
        :description="(failure.blockers ?? []).map((blocker) => blocker.message).join(' ') || failure.detail"
      />

      <template v-if="prompt">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-copy" @click="copy">
            {{ copied ? 'Скопировано' : 'Скопировать запрос' }}
          </UButton>

          <UButton v-if="!asking" size="sm" :disabled="!llm?.available" @click="send">
            Спросить модель
          </UButton>

          <!-- Неактивная кнопка обязана назвать причину (docs/04-ui.md). -->
          <p v-if="!llm?.available && !asking" class="min-w-0 flex-1 text-sm text-muted">
            {{ llm?.reason }}
          </p>
        </div>

        <!-- Ожидание без счётчика неотличимо от зависшего (docs/04-ui.md). -->
        <ModelProgress
          class="mb-3"
          :running="asking"
          :elapsed="elapsed"
          :limit-ms="llm?.timeouts.ask ?? 180000"
          :outcome="outcome"
          @cancel="cancelAsk"
        />

        <pre class="max-h-64 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre-wrap">{{ prompt }}</pre>
      </template>

      <div v-if="answer" class="mt-4">
        <div class="mb-2 flex flex-wrap items-center gap-3">
          <h3 class="font-medium">Ответ модели</h3>
          <p class="text-sm text-muted">Предложение, а не решение: применяете вы.</p>
        </div>
        <slot name="answer" :answer="answer" />
        <div class="docdd-answer">
          <DocumentText :body="answer" />
        </div>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
/* Ответ бывает длинным: держим его в своих берегах, а не растягиваем экран. */
.docdd-answer {
  max-height: 32rem;
  overflow-y: auto;
}
</style>
