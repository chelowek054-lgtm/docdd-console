<script setup lang="ts">
/**
 * Состояние описи файлов (docs/07-maps.md, раздел «Опись файлов»). Цифра
 * всегда с причиной: за каждой — список файлов, а не общее ощущение.
 */
const props = defineProps<{ projectId: string }>();

interface Inventory {
  total: number;
  described: number;
  pending: string[];
  changed: string[];
  gone: string[];
  skipped: { path: string; why: string }[];
  next: string[];
  portion: number;
}

const { data, refresh } = useFetch<Inventory>(() => `/api/projects/${props.projectId}/map/inventory`, {
  key: () => `inventory:${props.projectId}`
});

const rebuilding = ref(false);

/**
 * Файл, застрявший под утратившей силу картой: карту пометили `superseded`,
 * а он всё ещё считается описанным (docs/07-maps.md).
 */
async function rebuild() {
  rebuilding.value = true;
  try {
    await $fetch(`/api/projects/${props.projectId}/map/inventory/rebuild`, { method: 'POST' });
    await refresh();
  } finally {
    rebuilding.value = false;
  }
}

const shown = ref('');

const left = computed(() => {
  const state = data.value;
  if (!state) return 0;
  return state.pending.length + state.changed.length;
});

const files = computed(() => {
  const state = data.value;
  if (!state) return [];
  if (shown.value === 'pending') return state.pending;
  if (shown.value === 'changed') return state.changed;
  if (shown.value === 'gone') return state.gone;
  if (shown.value === 'skipped') return state.skipped.map((file) => `${file.path} — ${file.why}`);
  return [];
});

function toggle(which: string) {
  shown.value = shown.value === which ? '' : which;
}
</script>

<template>
  <div v-if="data" class="rounded border border-default p-3">
    <!-- Пустой проект — состояние, а не ошибка: говорим о нём словами. -->
    <p v-if="data.total === 0" class="text-sm">
      В проекте нет файлов кода — описывать нечего. Проверьте <code>sources.code</code> в манифесте:
      карта строится по нему.
    </p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <span class="font-medium">Опись: {{ plural(data.total, 'файл', 'файла', 'файлов') }}</span>

        <span class="text-muted">описано {{ data.described }}</span>

        <UButton
          v-if="data.pending.length"
          size="xs"
          variant="soft"
          color="warning"
          @click="toggle('pending')"
        >
          ждут очереди: {{ data.pending.length }}
        </UButton>

        <UButton
          v-if="data.changed.length"
          size="xs"
          variant="soft"
          color="error"
          @click="toggle('changed')"
        >
          изменились после описания: {{ data.changed.length }}
        </UButton>

        <!-- Посмотрены и в карту не положены: в очередь они не идут. -->
        <UButton
          v-if="data.skipped.length"
          size="xs"
          variant="soft"
          color="neutral"
          @click="toggle('skipped')"
        >
          не в карте: {{ data.skipped.length }}
        </UButton>

        <UButton v-if="data.gone.length" size="xs" variant="soft" color="neutral" @click="toggle('gone')">
          исчезли: {{ data.gone.length }}
        </UButton>

        <span v-if="left === 0 && !data.gone.length" class="text-muted">
          всё описано и с тех пор не менялось
        </span>

        <UButton size="xs" variant="ghost" color="neutral" :loading="rebuilding" @click="rebuild">
          Пересчитать опись
        </UButton>
      </div>

      <p v-if="left > data.portion" class="mt-2 text-sm text-muted">
        Один заход описывает {{ data.portion }} файлов: за ним останется ещё {{ left - data.portion }}.
        Большой проект описывается за несколько подходов, а не одним ответом.
      </p>

      <ul v-if="files.length" class="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
        <li v-for="file in files" :key="file" class="font-mono text-muted">{{ file }}</li>
      </ul>
    </template>
  </div>
</template>
