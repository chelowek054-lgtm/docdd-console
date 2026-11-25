<script setup lang="ts">
import type { Difference, SystemDesign } from '~~/server/lib/system-design';

const props = defineProps<{ projectId: string }>();
const { t } = useT();
const route = useRoute();
const { allowed } = useMe(() => props.projectId);
const editing = ref(false);
type Position = { x: number; y: number };
const reader = ref<{ editorViewport: () => Position & { zoom: number }; editorPositions: () => Record<string, Position> }>();
const initialViewport = ref<(Position & { zoom: number })>();
const initialPositions = ref<Record<string, Position>>();
function toggleEditor() {
  if (!editing.value && reader.value) {
    initialPositions.value = reader.value.editorPositions();
    initialViewport.value = Object.keys(initialPositions.value).length ? reader.value.editorViewport() : undefined;
  }
  editing.value = !editing.value;
}
const canEdit = computed(() => allowed('edit_draft').allowed);
const editorScope = computed(() => typeof route.query['group-sysdesign'] === 'string' ? route.query['group-sysdesign'] : '');
const { data, pending, error, refresh } = useFetch<{ sysdesign: SystemDesign }>(
  () => `/api/projects/${props.projectId}/map?kind=sysdesign`,
  { server: false }
);
const { data: report, status, error: compareError, execute } = useFetch<{ differences: Difference[] }>(
  () => `/api/projects/${props.projectId}/map/compare-design`,
  { immediate: false, server: false, watch: false }
);
const design = computed(() => data.value?.sysdesign);
const nodes = computed(() => design.value?.nodes.map((node) => ({ ...node, summary: node.reference })) ?? []);
const showStandards = ref(false);
const edges = computed(() => design.value?.relations.map((edge) => ({
  from: edge.from, to: edge.to, type: edge.kind, summary: edge.label
})) ?? []);
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold">System Design</h2>
    <p v-if="error" role="alert">{{ error.message }}</p>
    <p v-else-if="pending">{{ t('st2.loading') }}</p>
    <template v-else-if="design">
      <UButton v-if="canEdit" size="sm" variant="soft" :icon="editing ? 'i-lucide-eye' : 'i-lucide-pencil'"
        :aria-pressed="editing" @click="toggleEditor">{{ t(editing ? 'maps.editor.view' : 'maps.editor.open') }}</UButton>
      <ClientOnly v-if="editing && canEdit">
        <MapFlowEditor template="sysdesign" :project-id="projectId" :scope="editorScope" :capabilities="nodes"
          :relations="edges" v-bind="{ initialViewport, initialPositions }" @saved="refresh()" />
      </ClientOnly>
      <p v-if="!design.nodes.length && !editing">{{ t('maps.sysdesign.empty') }}</p>
      <div v-if="design.nodes.length" v-show="!editing || !canEdit" class="space-y-4">
        <LazyStandardMapGraph ref="reader" template="sysdesign" :nodes="nodes" :edges="edges">
          <template #toolbar>
            <UButton size="xs" :loading="status === 'pending'" @click="execute()">{{ t('sd.compare') }}</UButton>
            <UButton v-if="design.standards.length" size="xs" variant="outline" :aria-expanded="showStandards" @click="showStandards = !showStandards">{{ t('sd.standards') }}</UButton>
          </template>
          <template #node-details="{ node: selected }">
            <template v-for="node in design.nodes.filter((item) => item.id === selected.id)" :key="node.id">
          <dl class="mt-2 grid gap-1 text-sm">
            <template v-for="field in (['reference', 'inputs', 'outputs', 'formats', 'hot_path', 'algorithm', 'language', 'runtime', 'realized_by'] as const)" :key="field">
              <div v-if="node[field]?.length"><dt class="inline font-medium">{{ t('sd.' + field) }} · </dt><dd class="inline">{{ Array.isArray(node[field]) ? (node[field] as string[]).join(', ') : node[field] }}</dd></div>
            </template>
            <div v-if="node.load">{{ t('sd.load') }} · {{ node.load.value }} {{ node.load.unit }}</div>
            <div v-if="node.decisions?.length">
              {{ t('sd.decisions') }} ·
              <NuxtLink v-for="id in node.decisions" :key="id" class="mr-2 underline" :to="`/projects/${projectId}/records/${id}`">{{ id }}</NuxtLink>
            </div>
          </dl>
            </template>
          </template>
        </LazyStandardMapGraph>
        <p v-if="compareError" role="alert">{{ compareError.message }}</p>
        <div v-else-if="report" aria-live="polite">
          <p v-if="!report.differences.length">{{ t('sd.clean') }}</p>
          <ul v-else class="list-disc pl-5">
            <li v-for="difference in report.differences" :key="JSON.stringify(difference)">
              {{ t('sd.' + difference.code) }} · {{ difference.location }} · {{ difference.detail }}
            </li>
          </ul>
        </div>
      </div>
      <div v-if="showStandards">
        <p v-for="standard in design.standards" :key="standard.id">{{ standard.language }} · {{ standard.configs.join(', ') }} <span v-if="standard.coverage_min !== undefined">· ≥ {{ standard.coverage_min }}%</span></p>
      </div>
    </template>
  </section>
</template>
