<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { Vision } from '~~/server/lib/maps';

/**
 * Вектор проекта — карточка над функциональной картой (docs/04-ui.md,
 * «Функциональная карта»; docs/07-maps.md, «Вектор проекта»). Проблема, для
 * кого, что считается успехом, чего продукт не делает — и след: какая карта
 * объявила, когда и кто подтвердил. Правка — формой, но не поверх подтверждённого:
 * каждое «Сохранить» заводит новый черновик карты и ждёт подтверждения человеком.
 */
const props = defineProps<{
  projectId: string;
  vision: (Vision & { declaredBy?: string; declaredAt?: string; declaredByRole?: string | null }) | null;
}>();

const emit = defineEmits<{ changed: [] }>();

const FIELDS = [
  { key: 'problem', label: 'Какую проблему решает продукт', hint: 'Языком того, у кого она есть: что болит и почему это важно' },
  { key: 'audience', label: 'Для кого', hint: 'Кто пользуется и кому это важно' },
  { key: 'outcome', label: 'Что считается успехом', hint: 'По чему поймём, что проблема решена' },
  { key: 'not', label: 'Чего продукт не делает', hint: 'Решения, а не «пока не успели»' }
] as const;

type Key = (typeof FIELDS)[number]['key'];

/**
 * Аккордеон: вектор длинный и нужен не всегда, поэтому его можно свернуть.
 * Выбор помнится в браузере; правка и неподтверждённый черновик раскрывают
 * карточку сами — иначе их легко не заметить.
 */
const STORAGE_KEY = 'docdd:vision-open';
const expanded = ref(true);
onMounted(() => {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '0') expanded.value = false;
  } catch { /* хранилище может быть закрыто — карточка просто раскрыта */ }
});
function toggle() {
  expanded.value = !expanded.value;
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0');
  } catch { /* не страшно: выбор не запомнится */ }
}

const editing = ref(false);
const form = ref<Record<Key, string>>({ problem: '', audience: '', outcome: '', not: '' });
const saving = ref(false);
const confirming = ref(false);
const failure = ref<ApiFailure | null>(null);
const draft = ref<string | null>(null);

function startEdit() {
  form.value = {
    problem: props.vision?.problem ?? '',
    audience: props.vision?.audience ?? '',
    outcome: props.vision?.outcome ?? '',
    not: props.vision?.not ?? ''
  };
  failure.value = null;
  editing.value = true;
}

const filled = computed(() => FIELDS.some((field) => form.value[field.key].trim() !== ''));

async function save() {
  saving.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/map/capability`, {
      method: 'POST',
      body: { action: 'vision', vision: form.value },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    draft.value = (response as { record?: { id: string } }).record?.id ?? null;
    editing.value = false;
  } finally {
    saving.value = false;
  }
}

/** Подтверждение прямо здесь: те же два перехода, что и везде (docs/adr/0012-status-reopening.md). */
async function confirm() {
  if (!draft.value) return;
  confirming.value = true;
  failure.value = null;
  try {
    for (const status of ['review', 'approved']) {
      const response = await $fetch(`/api/projects/${props.projectId}/records/${draft.value}/status`, {
        method: 'POST',
        body: { status },
        ignoreResponseError: true
      });
      const problem = failureOf(response);
      if (problem) {
        failure.value = problem;
        return;
      }
    }
    draft.value = null;
    emit('changed');
  } finally {
    confirming.value = false;
  }
}

const shown = computed(() => expanded.value || editing.value || draft.value !== null);

const trace = computed(() => {
  const v = props.vision;
  if (!v?.declaredBy) return '';
  return [v.declaredBy, v.declaredAt, v.declaredByRole ?? 'автор не указан'].filter(Boolean).join(' · ');
});
</script>

<template>
  <UCard :ui="{ header: shown ? '' : 'border-b-0', body: shown ? '' : 'hidden' }">
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="flex min-w-0 items-start gap-2 text-left"
          :aria-expanded="shown"
          @click="toggle"
        >
          <UIcon :name="shown ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="mt-1 size-4 shrink-0" />
          <span>
            <span class="block font-medium">Вектор проекта</span>
            <span class="block text-sm text-muted">Зачем продукт: к этому сверяется каждая возможность</span>
          </span>
        </button>
        <UButton
          v-if="!editing"
          class="ml-auto"
          size="xs"
          variant="soft"
          :icon="vision ? 'i-lucide-pencil' : 'i-lucide-plus'"
          @click="startEdit"
        >
          {{ vision ? 'Изменить вектор' : 'Записать вектор' }}
        </UButton>
      </div>
    </template>

    <p v-if="draft" class="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
      Черновик {{ draft }} создан: вектор вступит в силу после подтверждения.
      <UButton size="xs" :loading="confirming" @click="confirm">Подтвердить</UButton>
    </p>

    <form v-if="editing" class="space-y-3" @submit.prevent="save">
      <UFormField v-for="field in FIELDS" :key="field.key" :label="field.label" :description="field.hint">
        <UTextarea v-model="form[field.key]" class="w-full" :rows="2" autoresize />
      </UFormField>
      <div class="flex gap-2">
        <UButton type="submit" size="sm" :loading="saving" :disabled="!filled">Сохранить черновиком</UButton>
        <UButton size="sm" variant="ghost" color="neutral" @click="editing = false">Отмена</UButton>
      </div>
    </form>

    <dl v-else-if="vision" class="space-y-3 text-sm">
      <div v-for="field in FIELDS" v-show="vision[field.key]" :key="field.key">
        <dt class="text-xs text-muted">{{ field.label }}</dt>
        <dd class="leading-relaxed">{{ vision[field.key] }}</dd>
      </div>
      <p v-if="trace" class="text-xs text-muted">
        Объявлено картой
        <NuxtLink :to="`/projects/${projectId}/records/${vision.declaredBy}`" class="hover:underline">{{ trace }}</NuxtLink>
      </p>
    </dl>

    <p v-else class="text-sm text-muted">
      Вектор не записан. Без него функциональная карта — список функций без цели: непонятно, что в
      неё принимать, а что нет. Запишите, какую проблему решает продукт, для кого, по чему поймём успех
      и чего он не делает.
    </p>

    <UAlert v-if="failure" class="mt-3" color="error" variant="subtle" :title="failure.message" :description="failure.detail" />
  </UCard>
</template>
