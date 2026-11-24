<script setup lang="ts">
import { suggestId } from '~/utils/map-flow';

interface GroupNode { id: string; parent?: string; title?: string }
const props = defineProps<{ projectId: string; kind: 'domain' | 'sysdesign'; nodes: GroupNode[] }>();
const { t } = useT();
const { allowed } = useMe(() => props.projectId);
const members = ref<string[]>([]);
const title = ref('');
const summary = ref('');
const preview = ref('');
const saved = ref<string>();
const error = ref('');
const busy = ref(false);
const selected = computed(() => props.nodes.filter((node) => members.value.includes(node.id)));
const parents = computed(() => new Set(selected.value.map((node) => node.parent)));
const groups = computed(() => props.nodes.filter((node) => props.nodes.some((child) => child.parent === node.id)));
const destination = ref('root');

function propose() {
  const parent = selected.value[0]?.parent;
  if (destination.value === 'new' && (!title.value.trim() || !summary.value.trim())) return;
  if (!selected.value.length || parents.value.size !== 1) return;
  const groupId = suggestId(title.value.trim(), new Set(props.nodes.map((node) => node.id)), parent);
  const next = destination.value === 'new' ? groupId : destination.value === 'root' ? '' : destination.value.slice(3);
  const added = selected.value.map((node) => {
    const copy = { ...node };
    Reflect.deleteProperty(copy, 'declaredBy');
    delete copy.parent;
    return next ? { ...copy, parent: next } : copy;
  });
  if (destination.value === 'new') {
    const group = { id: groupId, title: title.value.trim(), ...(parent ? { parent } : {}) };
    added.unshift(props.kind === 'domain'
      ? { ...group, kind: 'context', summary: summary.value.trim() } as GroupNode
      : { ...group, kind: 'container', detail: 'template', realized_by: [], reference: summary.value.trim() } as GroupNode);
  }
  const fence = '```';
  preview.value = [fence + 'docdd-' + props.kind, JSON.stringify({ added: { nodes: added } }, null, 2), fence].join('\n');
}
async function save() {
  if (!preview.value || busy.value || !allowed('edit_draft').allowed) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await $fetch<{ record?: { id: string } }>(`/api/projects/${props.projectId}/map/draft`, {
      method: 'POST', body: { answer: preview.value, title: t('mapGroup.draft') }
    });
    saved.value = result.record?.id;
    preview.value = '';
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : String(exception);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <details v-if="nodes.length && allowed('edit_draft').allowed" class="rounded border border-default p-2">
    <summary class="cursor-pointer">{{ t('mapGroup.edit') }}</summary>
    <div class="mt-2 space-y-2">
      <USelectMenu v-model="members" multiple value-key="value"
        :items="nodes.map(node => ({ value: node.id, label: node.title ?? node.id }))" :placeholder="t('mapGroup.nodes')" />
      <USelect v-model="destination" :items="[
        { value: 'root', label: t('mapGroup.root') },
        { value: 'new', label: t('mapGroup.new') },
        ...groups.map(node => ({ value: 'id:' + node.id, label: node.title ?? node.id }))
      ]" :aria-label="t('mapGroup.target')" />
      <template v-if="destination === 'new'">
        <UInput v-model="title" :placeholder="t('mapGroup.title')" />
        <UTextarea v-model="summary" :placeholder="t('mapGroup.summary')" />
      </template>
      <UButton variant="outline" :disabled="!members.length || parents.size !== 1" @click="propose">{{ t('mapGroup.preview') }}</UButton>
      <div v-if="preview">
        <pre class="max-h-64 overflow-auto text-xs">{{ preview }}</pre>
        <UButton :loading="busy" @click="save">{{ t('mapGroup.save') }}</UButton>
        <UButton variant="ghost" @click="preview = ''">{{ t('mapGroup.cancel') }}</UButton>
      </div>
      <NuxtLink v-if="saved" class="underline" :to="`/projects/${projectId}/records/${saved}`">{{ saved }}</NuxtLink>
      <p v-if="error" role="alert">{{ error }}</p>
    </div>
  </details>
</template>
