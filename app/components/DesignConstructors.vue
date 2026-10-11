<script setup lang="ts">
import {
  FIELD_TYPES,
  constructorProblems,
  generateForm,
  generateTable,
  type FieldType
} from '~~/server/lib/design-constructors';
import { STACK_IDS, STACK_LABEL, type StackId } from '~~/server/lib/design-export';

/**
 * Конструкторы форм и таблиц (docs/04-ui.md, «Дизайн»; docs/16-design-system.md,
 * «Конструкторы»): по полям или колонкам — заготовка компонента выбранного стека
 * на токенах и заготовка словаря на каждый язык проекта. Файлы в проект
 * приложение не пишет: текст копируется и кладётся задачей или руками.
 */
const props = defineProps<{
  /** Языки продукта из токенов: по заготовке словаря на каждый. */
  locales: string[];
  /** Стеки, объявленные проектом; пусто — любой из четырёх. */
  stacks: StackId[];
}>();

const { t } = useT();

const kind = ref<'form' | 'table'>('form');
const stackIds = computed<StackId[]>(() => (props.stacks.length ? props.stacks : [...STACK_IDS]));
const stack = ref<StackId>(stackIds.value[0] ?? 'nuxt-ui');
watch(stackIds, (list) => { if (!list.includes(stack.value)) stack.value = list[0] ?? 'nuxt-ui'; });

const name = ref('profile');
const fields = ref<{ id: string; type: FieldType; required: boolean }[]>([
  { id: 'name', type: 'text', required: true },
  { id: 'email', type: 'email', required: true }
]);
const columns = ref<{ id: string; sortable: boolean }[]>([
  { id: 'id', sortable: true },
  { id: 'title', sortable: false }
]);

const ids = computed(() => (kind.value === 'form' ? fields.value.map((item) => item.id) : columns.value.map((item) => item.id)));
const problems = computed(() => constructorProblems(name.value.trim(), ids.value));
const locales = computed(() => (props.locales.length ? props.locales : ['ru', 'en']));

const output = computed(() => {
  if (problems.value.length > 0) return null;
  return kind.value === 'form'
    ? generateForm(stack.value, { name: name.value.trim(), fields: fields.value }, locales.value)
    : generateTable(stack.value, { name: name.value.trim(), columns: columns.value }, locales.value);
});

function addRow() {
  if (kind.value === 'form') fields.value = [...fields.value, { id: '', type: 'text', required: false }];
  else columns.value = [...columns.value, { id: '', sortable: false }];
}
function removeRow(at: number) {
  if (kind.value === 'form') fields.value = fields.value.filter((_, index) => index !== at);
  else columns.value = columns.value.filter((_, index) => index !== at);
}

const copied = ref('');
async function copy(key: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = ''; }, 1500);
  } catch {
    // Буфер недоступен: текст остаётся на экране.
  }
}

function problemText(problem: string): string {
  if (problem === 'name') return t('dcn.problem.name');
  if (problem === 'empty') return t('dcn.problem.empty');
  if (problem === 'duplicate') return t('dcn.problem.duplicate');
  if (problem.startsWith('id:')) return t('dcn.problem.id', { id: problem.slice(3) });
  return problem;
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-medium">{{ t('dcn.title') }}</h2>
      <p class="text-sm text-muted">{{ t('dcn.lead') }}</p>
    </div>

    <section class="grid gap-3 sm:grid-cols-3">
      <UFormField :label="t('dcn.kind')">
        <USelect
          v-model="kind"
          :items="[{ label: t('dcn.kind.form'), value: 'form' }, { label: t('dcn.kind.table'), value: 'table' }]"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('dcn.stack')">
        <USelect v-model="stack" :items="stackIds.map((id) => ({ label: STACK_LABEL[id], value: id }))" class="w-full" />
      </UFormField>
      <UFormField :label="t('dcn.name')" :hint="t('dcn.name.hint')">
        <UInput v-model="name" placeholder="profile" class="w-full" />
      </UFormField>
    </section>

    <section class="space-y-2">
      <h3 class="font-medium">{{ kind === 'form' ? t('dcn.fields') : t('dcn.columns') }}</h3>
      <div v-if="kind === 'form'" class="space-y-2">
        <div v-for="(field, at) in fields" :key="at" class="flex flex-wrap items-center gap-2">
          <UInput v-model="field.id" :placeholder="t('dcn.id')" class="min-w-32 flex-1" />
          <USelect v-model="field.type" :items="FIELD_TYPES.map((type) => ({ label: type, value: type }))" class="w-36" />
          <UCheckbox v-model="field.required" :label="t('dcn.required')" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('dcn.remove')" @click="removeRow(at)" />
        </div>
      </div>
      <div v-else class="space-y-2">
        <div v-for="(column, at) in columns" :key="at" class="flex flex-wrap items-center gap-2">
          <UInput v-model="column.id" :placeholder="t('dcn.id')" class="min-w-32 flex-1" />
          <UCheckbox v-model="column.sortable" :label="t('dcn.sortable')" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('dcn.remove')" @click="removeRow(at)" />
        </div>
      </div>
      <UButton size="xs" variant="soft" icon="i-lucide-plus" @click="addRow">{{ t('dcn.add') }}</UButton>
    </section>

    <p v-for="problem in problems" :key="problem" class="text-sm text-warning">{{ problemText(problem) }}</p>

    <section v-if="output" class="space-y-3">
      <h3 class="font-medium">{{ t('dcn.result') }}</h3>
      <div v-for="file in output.files" :key="file.path" class="space-y-1 border-t border-default pt-3">
        <div class="flex flex-wrap items-center gap-2">
          <code class="text-xs">{{ file.path }}</code>
          <UButton
            class="ml-auto"
            size="xs"
            variant="ghost"
            :icon="copied === file.path ? 'i-lucide-check' : 'i-lucide-copy'"
            @click="copy(file.path, file.content)"
          >
            {{ t('common.copy') }}
          </UButton>
        </div>
        <pre class="max-h-72 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ file.content }}</pre>
      </div>
      <p class="text-xs text-muted">{{ t('dcn.note', { locales: locales.join(', ') }) }}</p>
    </section>
  </div>
</template>
