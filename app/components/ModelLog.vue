<script setup lang="ts">
import type { LogLine } from '~/composables/useModelRequest';

/**
 * Лента работы модели (docs/04-ui.md, раздел «Что модель делает прямо сейчас»).
 * Показывает то же, что человек увидел бы в её чате: текст ответа по мере
 * написания и обращения к файлам и командам. Лента — не ответ: решает человек
 * по ответу, а лента объясняет, как он получился.
 */
const props = defineProps<{ lines: LogLine[]; running: boolean }>();

const open = ref(true);
const box = ref<HTMLElement | null>(null);
/** Человек тронул ленту — она перестаёт уезжать у него из-под глаз. */
const following = ref(true);

const last = computed(() => props.lines[props.lines.length - 1]?.text.trim().slice(0, 120) ?? '');

function onScroll() {
  const element = box.value;
  if (!element) return;
  following.value = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
}

watch(
  () => props.lines.length,
  async () => {
    if (!following.value || !open.value) return;
    await nextTick();
    const element = box.value;
    if (element) element.scrollTop = element.scrollHeight;
  }
);
</script>

<template>
  <div v-if="props.lines.length" class="rounded border border-default">
    <button
      type="button"
      class="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm"
      @click="open = !open"
    >
      <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="text-muted" />
      <span class="font-medium">Что делает модель</span>
      <span class="text-muted">· {{ plural(props.lines.length, 'шаг', 'шага', 'шагов') }}</span>
      <!-- Свёрнутая лента показывает, чем модель занята сейчас. -->
      <span v-if="!open && last" class="min-w-0 flex-1 truncate text-xs text-muted">{{ last }}</span>
    </button>

    <div
      v-show="open"
      ref="box"
      class="max-h-72 overflow-y-auto border-t border-default px-3 py-2"
      @scroll="onScroll"
    >
      <div v-for="(line, index) in props.lines" :key="index" class="py-0.5 text-xs">
        <p v-if="line.kind === 'text'" class="whitespace-pre-wrap">{{ line.text }}</p>

        <p v-else-if="line.kind === 'action'" class="font-mono text-primary">
          → {{ line.text }}
        </p>

        <p v-else class="font-mono" :class="line.failed ? 'text-error' : 'text-muted'">
          {{ line.failed ? '× ' : '· ' }}{{ line.text }}
        </p>
      </div>

      <p v-if="props.running" class="py-1 text-xs text-muted">…</p>
    </div>
  </div>
</template>
