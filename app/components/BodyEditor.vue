<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Правка текста документа человеком (docs/adr/0011-body-editing.md). `body` —
 * тело записи целиком, как отдаёт сервер (текст человека и раздел «Журнал»
 * вместе): именно это сравнивает сервер при сохранении, поэтому здесь
 * хранится без обрезки. Раздел «Журнал» из неё вырезается только для показа
 * и правки — сам он не редактируется и не отправляется отдельно.
 */
const props = defineProps<{
  projectId: string;
  recordId: string;
  body: string;
  status: string;
  roles: { id: string; name: string }[];
}>();

const emit = defineEmits<{ changed: [] }>();

/** Текст человека без раздела «Журнал» — то, что показывается и правится. */
function proseOf(body: string): string {
  const at = body.search(/^##\s+Журнал\s*$/m);
  return at === -1 ? body : body.slice(0, at);
}

const prose = computed(() => proseOf(props.body));

const editing = ref(false);
const draft = ref('');
/** Тело целиком на момент открытия правки: по нему сервер ловит расхождение с диском. */
const baseline = ref('');
const actor = ref(props.roles[0]?.id ?? '');
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);
const done = ref('');

const locked = computed(() => SETTLED_STATUSES.includes(props.status));

/**
 * Пока открыт редактор, запись могла поменяться другим действием на этой же
 * странице — сменой статуса, например: она тоже пишет строку в журнал. Держать
 * открытым редактор на заведомо устаревшем `baseline` бессмысленно — сохранение
 * всё равно откажет, а правку жалко потерять молча, поэтому не отменяем её
 * без предупреждения.
 */
const stale = computed(() => editing.value && props.body !== baseline.value);

function startEdit() {
  baseline.value = props.body;
  draft.value = prose.value;
  failure.value = null;
  done.value = '';
  editing.value = true;
}

function cancel() {
  editing.value = false;
}

async function save() {
  busy.value = true;
  failure.value = null;
  try {
    const response = await $fetch<{ journal?: string } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/records/${props.recordId}/body`,
      {
        method: 'POST',
        body: { body: draft.value, baseline: baseline.value, actor: actor.value },
        // Отказ приходит телом ответа: причину показываем как есть, не бросаем исключение.
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    done.value = (response as { journal?: string }).journal ?? '';
    editing.value = false;
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">Текст документа</h2>
        <USelect
          v-if="editing && roles.length"
          v-model="actor"
          size="sm"
          class="ml-auto w-48"
          :items="roles.map((role) => ({ label: role.name, value: role.id }))"
        />
        <UButton v-if="!editing && !locked" size="sm" variant="ghost" class="ml-auto" @click="startEdit">
          Редактировать
        </UButton>
      </div>
    </template>

    <!-- Пустая недоступная правка без причины бесполезна: см. кнопки статуса (docs/04-ui.md). -->
    <p v-if="locked" class="mb-3 text-sm text-muted">
      Запись в статусе «{{ statusLabel(status) }}»: содержание подтверждено, правка текста в
      обход этого факта запрещена. Нужна другая формулировка — заведите запись-преемника,
      сославшись на неё через <code>supersedes</code>.
    </p>

    <template v-if="editing">
      <UAlert
        v-if="stale"
        class="mb-3"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Запись обновилась, пока вы её редактировали"
        description="Другим действием на этой же странице — например, сменой статуса. Сохранить эту правку не выйдет: перенесите текст, отмените и откройте редактор заново."
      />
      <UTextarea v-model="draft" :rows="16" autoresize class="w-full font-mono text-sm" />
      <div class="mt-3 flex items-center gap-2">
        <UButton :loading="busy" :disabled="stale" @click="save">Сохранить</UButton>
        <UButton variant="ghost" color="neutral" :disabled="busy" @click="cancel">Отменить</UButton>
      </div>
    </template>
    <DocumentText v-else :body="prose" />

    <UAlert
      v-if="failure"
      class="mt-4"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="(failure.blockers ?? []).map((blocker) => blocker.message).join(' ') || failure.detail"
    />
    <UAlert
      v-else-if="done"
      class="mt-4"
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      title="Текст сохранён"
      :description="`В журнал добавлено: ${done}`"
    />
  </UCard>
</template>
