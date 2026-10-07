<script setup lang="ts">
import { useModelJobs } from '~/stores/modelJobs';

/**
 * «Модель работает: N» в шапке (docs/04-ui.md, «Запрос к модели»): запросы живут в
 * общем хранилище, и с любой страницы видно, что идёт, сколько, и куда вернуться.
 * Закончившееся с ответом, который ждёт возврата, помечено, пока его не откроют.
 */
const store = useModelJobs();
const open = ref(false);

const waiting = computed(() => store.visible.filter((job) => !job.running).length);

function minutes(seconds: number): string {
  return seconds < 60 ? `${seconds} с` : `${Math.floor(seconds / 60)} мин ${seconds % 60} с`;
}

// Обновление страницы оборвёт идущие запросы: хранилище в памяти браузера.
function warn(event: BeforeUnloadEvent) {
  if (store.runningCount === 0) return;
  event.preventDefault();
  event.returnValue = '';
}
onMounted(() => window.addEventListener('beforeunload', warn));
onBeforeUnmount(() => window.removeEventListener('beforeunload', warn));
</script>

<template>
  <div v-if="store.visible.length" class="relative">
    <!-- Компактно: значок и число. Длинная подпись не помещалась в шапку и роняла её на вторую строку. -->
    <UButton
      size="sm"
      variant="soft"
      :color="store.runningCount ? 'primary' : 'warning'"
      icon="i-lucide-sparkles"
      :title="store.runningCount ? `Модель работает: ${store.runningCount}` : `Ответ ждёт: ${waiting}`"
      :aria-label="store.runningCount ? `Модель работает: ${store.runningCount}` : `Ответ ждёт: ${waiting}`"
      @click="open = !open"
    >
      {{ store.runningCount || waiting }}
    </UButton>

    <div v-if="open" class="absolute right-0 z-50 mt-2 w-96 space-y-2 rounded-lg border border-default bg-default p-3 shadow-lg">
      <div v-for="job in store.visible" :key="job.key" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="min-w-0 flex-1">
          {{ job.label }}
          <span class="text-xs text-muted">
            · {{ job.running ? minutes(job.elapsed) : job.outcome?.kind === 'failure' ? 'отказ' : 'ответ готов' }}
          </span>
        </span>
        <UButton size="xs" variant="ghost" :to="job.to" @click="open = false">Открыть</UButton>
        <UButton v-if="job.running" size="xs" variant="ghost" color="error" @click="store.cancel(job.key)">Отменить</UButton>
        <UButton v-else size="xs" variant="ghost" color="neutral" @click="store.acknowledge(job.key); store.drop(job.key)">Сбросить</UButton>
      </div>
    </div>
  </div>
</template>
