<script setup lang="ts">
/**
 * Обучение новому человеку (R-0094, docs/04-ui.md, «Обучение»): три коротких шага —
 * как читать стратегию и карты, почему задача не уходит в работу без документа,
 * как работать с моделью через ветку и дифф. «Пропустить» убирает его сразу;
 * пройденное и пропущенное помнится в браузере по проекту.
 */
const props = defineProps<{ projectId: string }>();
const { t } = useT();

const STEPS = ['maps', 'docs', 'model'] as const;
const key = computed(() => `docdd:tour:${props.projectId}`);
const visible = ref(false);
const step = ref(0);

onMounted(() => {
  try {
    visible.value = localStorage.getItem(key.value) === null;
  } catch { visible.value = false; /* хранилище закрыто — не навязываем обучение при каждом входе */ }
});

function finish() {
  visible.value = false;
  try { localStorage.setItem(key.value, 'done'); } catch { /* не страшно: покажется снова */ }
}
</script>

<template>
  <UCard v-if="visible" class="border-primary/40">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-graduation-cap" class="mt-0.5 size-5 shrink-0 text-primary" />
      <div class="min-w-0 flex-1 space-y-1">
        <p class="text-xs text-muted">{{ t('tour.progress', { n: step + 1, total: STEPS.length }) }}</p>
        <p class="font-medium">{{ t(`tour.${STEPS[step]}.title`) }}</p>
        <p class="text-sm text-muted">{{ t(`tour.${STEPS[step]}.text`) }}</p>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
        <UButton v-if="step < STEPS.length - 1" size="sm" @click="step += 1">{{ t('tour.next') }}</UButton>
        <UButton v-else size="sm" @click="finish">{{ t('tour.done') }}</UButton>
        <UButton size="sm" variant="ghost" color="neutral" @click="finish">{{ t('tour.skip') }}</UButton>
      </div>
    </div>
  </UCard>
</template>
