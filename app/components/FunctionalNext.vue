<script setup lang="ts">
import {
  HORIZON_LABEL,
  PRIORITY_LABEL,
  startNow,
  type CapabilityLike,
  type RelationLike
} from '../../server/lib/functional';

/**
 * «Можно начинать» (docs/07-maps.md, «Что дальше и что заденет»): нижние
 * возможности, которым ничто не мешает, в порядке приоритета, горизонта и
 * «освободит N». Ответ на «какой кусок брать следующим». Только читает: клик
 * по строке выбирает возможность, а «не оценено» ведёт к тем, кому оценки нет.
 */
const props = defineProps<{
  capabilities: (CapabilityLike & { title?: string })[];
  relations: RelationLike[];
}>();

const emit = defineEmits<{
  select: [id: string];
  'show-unrated': [];
}>();

const SHOWN = 5;
const all = ref(false);

const next = computed(() => startNow(props.capabilities, props.relations));
const titles = computed(() => new Map(props.capabilities.map((item) => [item.id, item.title ?? item.id])));
const shown = computed(() => (all.value ? next.value.items : next.value.items.slice(0, SHOWN)));
const hidden = computed(() => Math.max(0, next.value.items.length - SHOWN));
</script>

<template>
  <div v-if="capabilities.length > 0" class="mb-3 rounded border border-default p-3 text-sm">
    <div class="mb-1 flex flex-wrap items-center gap-2">
      <h3 class="font-medium">Можно начинать</h3>
      <span v-if="next.items.length" class="text-xs text-muted">
        по приоритету, горизонту и тому, сколько освободит
      </span>
      <UButton
        v-if="next.unrated"
        class="ml-auto"
        size="xs"
        variant="ghost"
        color="neutral"
        @click="emit('show-unrated')"
      >
        и ещё {{ next.unrated }} не оценено
      </UButton>
    </div>

    <p v-if="next.items.length === 0" class="text-muted">
      Сейчас начинать нечего: всё реализовано, ждёт зависимости или отложено.
    </p>
    <ol v-else class="space-y-1">
      <li v-for="item in shown" :key="item.id" class="flex flex-wrap items-center gap-2">
        <button type="button" class="text-left hover:underline" @click="emit('select', item.id)">
          {{ titles.get(item.id) }}
        </button>
        <UBadge v-if="item.priority" size="xs" variant="subtle" color="neutral">{{ PRIORITY_LABEL[item.priority] }}</UBadge>
        <UBadge v-if="item.horizon" size="xs" variant="outline" color="neutral">{{ HORIZON_LABEL[item.horizon] }}</UBadge>
        <span v-if="item.unblocks" class="text-xs text-muted">освободит {{ item.unblocks }}</span>
      </li>
    </ol>
    <UButton v-if="hidden > 0" class="mt-1" size="xs" variant="link" color="neutral" @click="all = !all">
      {{ all ? 'Свернуть' : `Показать ещё ${hidden}` }}
    </UButton>
  </div>
</template>
