<script setup lang="ts">
// Форма новой пользовательской карты (docs/adr/0028-custom-maps.md, docs/04-ui.md
// «Карты по желанию пользователя»): определение пишется в манифест карт, узлы — потом.
import type { ApiFailure } from '~/composables/useProjectIndex';
import { slugify } from '~~/server/lib/scaffold';
import { ROLE_MAP_TEMPLATES, type RoleMapTemplate } from '~~/server/lib/role-maps';
import type { CustomMapDefinition, CustomMapFeature, CustomRelationStyle } from '~~/server/lib/types';
const { t } = useT();

const props = defineProps<{ projectId: string; engines: readonly string[] }>();
const emit = defineEmits<{ created: [definition: CustomMapDefinition] }>();
const open = defineModel<boolean>('open', { required: true });

const STYLE_LABEL: Record<CustomRelationStyle, string> = {
  get depends() { return t('t83.m2.rel.depends'); },
  get uses() { return t('t83.m2.rel.uses'); },
  get feeds() { return t('t83.m2.rel.feeds'); },
  get triggers() { return t('t83.m2.rel.triggers'); },
  get replaces() { return t('t83.m2.rel.replaces'); }
};
const STYLES = Object.keys(STYLE_LABEL) as CustomRelationStyle[];
const FEATURES: { value: CustomMapFeature; label: string }[] = [
  { value: 'status', get label() { return t('t83.m2.feat.status'); } },
  { value: 'priority', get label() { return t('t83.m2.feat.priority'); } },
  { value: 'horizon', get label() { return t('t83.m2.feat.horizon'); } },
  { value: 'evidence', get label() { return t('t83.m2.feat.evidence'); } },
  { value: 'links', get label() { return t('t83.m2.feat.links'); } }
];

function blank() {
  return {
    title: '',
    id: '',
    summary: '',
    label: '',
    plural: '',
    relations: STYLES.map((style) => ({ id: style, label: STYLE_LABEL[style], style })),
    features: [] as CustomMapFeature[]
  };
}

const form = reactive(blank());
// id подставляется из названия, пока человек не правил его сам.
const idTouched = ref(false);
watch(() => form.title, (title) => { if (!idTouched.value) form.id = slugify(title, 40); });

const error = ref<string | null>(null);
const busy = ref(false);

watch(open, (value) => {
  if (!value) return;
  Object.assign(form, blank());
  idTouched.value = false;
  error.value = null;
});

/** Заготовка под роль (R-0087): подставляет определение, дальше его правят как обычно. */
function applyTemplate(template: RoleMapTemplate) {
  const def = template.definition;
  Object.assign(form, {
    title: def.title,
    id: def.id,
    summary: def.summary ?? '',
    label: def.node.label,
    plural: def.node.plural,
    relations: def.relations.map((item) => ({ ...item })),
    features: [...def.features]
  });
  idTouched.value = true;
}

/** Шаблон с движком (ADR-0035): форма не нужна, в манифест пишется строка с `template`. */
const ENGINES: { value: string; label: string }[] = [
  { value: 'codemap', get label() { return t('maps.v.codemap'); } },
  { value: 'dataflow', get label() { return t('maps.v.dataflow'); } },
  { value: 'userflow', get label() { return t('maps.v.userflow'); } }
];

async function createEngine(template: string) {
  error.value = null;
  busy.value = true;
  try {
    const response = await $fetch<{ definition: CustomMapDefinition } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/maps/custom`,
      { method: 'POST', body: { template } }
    );
    if ('error' in response) {
      error.value = response.error.message;
      return;
    }
    emit('created', response.definition);
    open.value = false;
  } catch (failure: unknown) {
    const data = (failure as { data?: { error?: ApiFailure; message?: string } }).data;
    error.value = data?.error?.message ?? data?.message ?? (failure as Error).message;
  } finally {
    busy.value = false;
  }
}

function addRelation() {
  form.relations.push({ id: '', label: '', style: 'depends' });
}

function toggleFeature(value: CustomMapFeature, on: boolean | 'indeterminate') {
  form.features = on === true ? [...new Set([...form.features, value])] : form.features.filter((item) => item !== value);
}

async function submit() {
  error.value = null;
  if (!form.title.trim() || !form.id.trim() || !form.label.trim() || !form.plural.trim()) {
    error.value = t('t83.m2.form.error');
    return;
  }
  const definition: CustomMapDefinition = {
    id: form.id.trim(),
    title: form.title.trim(),
    ...(form.summary.trim() ? { summary: form.summary.trim() } : {}),
    node: { label: form.label.trim(), plural: form.plural.trim() },
    relations: form.relations
      .map((item) => ({ ...item, id: item.id.trim(), label: item.label.trim() }))
      .filter((item) => item.id),
    features: form.features
  };
  busy.value = true;
  try {
    const response = await $fetch<{ definition: CustomMapDefinition } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/maps/custom`,
      { method: 'POST', body: definition }
    );
    if ('error' in response) {
      error.value = response.error.message;
      return;
    }
    emit('created', response.definition);
    open.value = false;
  } catch (failure: unknown) {
    // 409 custom_map_exists и прочие отказы приходят телом ошибки.
    const data = (failure as { data?: { error?: ApiFailure; message?: string } }).data;
    error.value = data?.error?.message ?? data?.message ?? (failure as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('t83.custom-map-form.1')" :description="t('t83.custom-map-form.2')">
    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-1">
          <p class="text-sm font-medium">{{ t('ctpl.engine') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in ENGINES"
              :key="item.value"
              size="xs"
              variant="soft"
              :disabled="engines.includes(item.value)"
              :icon="engines.includes(item.value) ? 'i-lucide-check' : undefined"
              :loading="busy"
              @click="createEngine(item.value)"
            >{{ item.label }}</UButton>
          </div>
          <p class="text-xs text-muted">{{ t('ctpl.engineHint') }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-sm font-medium">{{ t('t83.custom-map-form.3') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton v-for="template in ROLE_MAP_TEMPLATES" :key="template.role" size="xs" variant="soft" color="neutral" @click="applyTemplate(template)">{{ template.name }}</UButton>
          </div>
          <p class="text-xs text-muted">{{ t('t83.custom-map-form.4') }}</p>
        </div>
        <UFormField :label="t('t83.custom-map-form.5')" required>
          <UInput v-model="form.title" class="w-full" :placeholder="t('t83.custom-map-form.6')" />
        </UFormField>
        <UFormField label="id" required :help="t('t83.custom-map-form.7')">
          <UInput v-model="form.id" class="w-full font-mono" @update:model-value="idTouched = true" />
        </UFormField>
        <UFormField :label="t('t83.custom-map-form.8')">
          <UTextarea v-model="form.summary" class="w-full" :rows="2" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('t83.custom-map-form.9')" required>
            <UInput v-model="form.label" class="w-full" :placeholder="t('t83.custom-map-form.10')" />
          </UFormField>
          <UFormField :label="t('t83.custom-map-form.11')" required>
            <UInput v-model="form.plural" class="w-full" :placeholder="t('t83.custom-map-form.12')" />
          </UFormField>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t('t83.custom-map-form.13') }}</p>
          <div v-for="(item, at) in form.relations" :key="at" class="flex items-center gap-2">
            <UInput v-model="item.id" class="w-28 font-mono" size="sm" placeholder="id" />
            <UInput v-model="item.label" class="flex-1" size="sm" :placeholder="t('t83.custom-map-form.14')" />
            <USelect
              v-model="item.style"
              class="w-40"
              size="sm"
              :items="STYLES.map((style) => ({ label: STYLE_LABEL[style], value: style }))"
            />
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :title="t('t83.custom-map-form.15')" @click="form.relations.splice(at, 1)" />
          </div>
          <UButton icon="i-lucide-plus" size="xs" variant="soft" :label="t('t83.custom-map-form.16')" @click="addRelation" />
        </div>

        <div class="space-y-1">
          <p class="text-sm font-medium">{{ t('t83.custom-map-form.17') }}</p>
          <UCheckbox
            v-for="item in FEATURES"
            :key="item.value"
            :label="item.label"
            :model-value="form.features.includes(item.value)"
            @update:model-value="(on) => toggleFeature(item.value, on)"
          />
        </div>

        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" :label="t('t83.functional-tree.11')" @click="open = false" />
        <UButton :label="t('t83.custom-map-form.18')" :loading="busy" @click="submit" />
      </div>
    </template>
  </UModal>
</template>
