<script setup lang="ts">
export interface Capability {
  id: string;
  title?: string;
  parent?: string;
  declaredBy?: string;
  pending?: boolean;
}

const props = defineProps<{
  item: Capability;
  children: Capability[];
  allCapabilities: Capability[];
  expanded: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  select: [item: Capability];
  'add-child': [parentId: string];
  edit: [item: Capability];
  remove: [item: Capability];
}>();

const isOpen = computed(() => props.expanded.has(props.item.id));
function childrenOf(id: string): Capability[] {
  return props.allCapabilities.filter((item) => item.parent === id);
}
</script>

<template>
  <li>
    <div
      class="group flex items-center gap-1 rounded py-1 pr-1 hover:bg-elevated"
      :class="item.pending ? 'opacity-60' : ''"
    >
      <UButton
        v-if="children.length > 0"
        :icon="isOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        size="xs"
        variant="ghost"
        color="neutral"
        :aria-label="isOpen ? 'Свернуть' : 'Развернуть'"
        @click="emit('toggle', item.id)"
      />
      <span v-else class="inline-block w-6" />

      <button
        type="button"
        class="min-w-0 flex-1 truncate text-left text-sm hover:underline"
        @click="emit('select', item)"
      >
        {{ item.title ?? item.id }}
      </button>

      <UBadge v-if="item.pending" size="xs" color="neutral" variant="subtle">ещё не устоялось</UBadge>

      <!-- Кнопки — на весь ряд по наведению, не всегда видны: дерево читают чаще, чем правят. -->
      <div class="hidden shrink-0 gap-1 group-hover:flex">
        <UButton
          icon="i-lucide-plus"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Добавить подпункт"
          @click="emit('add-child', item.id)"
        />
        <UButton
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Переименовать"
          @click="emit('edit', item)"
        />
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Убрать"
          @click="emit('remove', item)"
        />
      </div>
    </div>

    <ul v-if="isOpen && children.length > 0" class="ml-3 border-l border-default pl-3">
      <FunctionalTreeNode
        v-for="child in children"
        :key="child.id"
        :item="child"
        :children="childrenOf(child.id)"
        :all-capabilities="allCapabilities"
        :expanded="expanded"
        @toggle="(id) => emit('toggle', id)"
        @select="(value) => emit('select', value)"
        @add-child="(id) => emit('add-child', id)"
        @edit="(value) => emit('edit', value)"
        @remove="(value) => emit('remove', value)"
      />
    </ul>
  </li>
</template>
