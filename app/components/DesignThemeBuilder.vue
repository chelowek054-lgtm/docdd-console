<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { MIN_CONTRAST, PALETTE_ROLES, paletteColorPractice, themeNames, themePalette, type BaseTheme, type DesignTokens } from '~~/server/lib/design';
import {
  suggestForeground,
  themeBlockText,
  themeContrast,
  themeProblems,
  type ThemeDraft
} from '~~/server/lib/design-theme';

/**
 * Конструктор тем (docs/04-ui.md, «Дизайн»; docs/16-design-system.md, «Цветовые
 * темы»): человек выбирает базу и меняет роли, а число контраста обновляется на
 * глазах — по тем же правилам, что у проверки токенов. Итог — блок
 * `docdd-design` и черновик записи `design`; подтверждает его человек, как любой
 * другой документ.
 */
const props = defineProps<{ projectId: string; tokens: DesignTokens }>();

const { t } = useT();

const mode = ref<BaseTheme>('light');
const name = ref('');
const label = ref('');
const minContrast = ref<number>(4.5);
const overrides = ref<Record<string, string>>({});

const base = computed<Record<string, string>>(() =>
  Object.fromEntries(Object.entries(themePalette(props.tokens, mode.value)).map(([role, item]) => [role, item.value]))
);
const roles = computed(() => {
  const present = Object.keys(base.value);
  return [...PALETTE_ROLES.filter((role) => present.includes(role)), ...present.filter((role) => !(PALETTE_ROLES as readonly string[]).includes(role))];
});

const draft = computed<ThemeDraft>(() => ({
  name: name.value.trim(),
  label: label.value.trim(),
  mode: mode.value,
  minContrast: minContrast.value > 4.5 ? minContrast.value : null,
  overrides: overrides.value
}));

const taken = computed(() => themeNames(props.tokens));
const problems = computed(() => themeProblems(draft.value, taken.value));
const rows = computed(() => themeContrast(base.value, draft.value));
const block = computed(() => themeBlockText(base.value, draft.value));

/** Практика цвета на реальных экранах: те же правила, что у проверки токенов (ADR-0026). */
const practice = computed(() => paletteColorPractice(
  { ...base.value, ...overrides.value },
  {
    name: name.value.trim() || 'theme',
    mode: mode.value,
    minContrast: minContrast.value > MIN_CONTRAST ? minContrast.value : MIN_CONTRAST,
    markets: props.tokens.audience.markets.map((item) => item.value)
  }
));

const current = (role: string) => overrides.value[role] ?? base.value[role] ?? '#000000';

function setColor(role: string, value: string) {
  const color = value.toUpperCase();
  const next = { ...overrides.value };
  if (!/^#[0-9A-F]{6}$/.test(color) || color === base.value[role]) delete next[role];
  else next[role] = color;
  overrides.value = next;
}

function reset() {
  overrides.value = {};
}

/** Подсказка для пары: сдвигает цвет текста, пока контраст не дойдёт до порога. */
function fix(foreground: string, background: string, min: number, role: string) {
  setColor(role, suggestForeground(foreground, background, min));
}

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(block.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    // Буфер недоступен: блок остаётся на экране, его можно выделить.
  }
}

const creating = ref(false);
const createdId = ref('');
const trouble = ref<ApiFailure | null>(null);

async function createDraft() {
  if (problems.value.length > 0) return;
  creating.value = true;
  trouble.value = null;
  try {
    const title = t('dtb.recordTitle', { name: draft.value.label || draft.value.name });
    const response = await $fetch<{ record?: { id: string } } | { error: ApiFailure }>(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: { type: 'design', title, body: `${t('dtb.recordLead', { name: draft.value.name })}\n\n${block.value}` },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) trouble.value = problem;
    else createdId.value = (response as { record?: { id: string } }).record?.id ?? '';
  } finally {
    creating.value = false;
  }
}

const problemText: Record<string, string> = {
  name: 'dtb.problem.name',
  reserved: 'dtb.problem.reserved',
  taken: 'dtb.problem.taken',
  empty: 'dtb.problem.empty'
};
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-medium">{{ t('dtb.title') }}</h2>
      <p class="text-sm text-muted">{{ t('dtb.lead') }}</p>
    </div>

    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <UFormField :label="t('dtb.name')" :hint="t('dtb.name.hint')">
        <UInput v-model="name" placeholder="ocean" class="w-full" />
      </UFormField>
      <UFormField :label="t('dtb.label')">
        <UInput v-model="label" :placeholder="t('dtb.label.placeholder')" class="w-full" />
      </UFormField>
      <UFormField :label="t('dtb.mode')">
        <USelect
          v-model="mode"
          :items="[{ label: t('dt.theme.light'), value: 'light' }, { label: t('dt.theme.dark'), value: 'dark' }]"
          class="w-full"
          @update:model-value="reset"
        />
      </UFormField>
      <UFormField :label="t('dtb.min')">
        <USelect
          v-model="minContrast"
          :items="[{ label: '4.5:1 (AA)', value: 4.5 }, { label: '7:1 (AAA)', value: 7 }]"
          class="w-full"
        />
      </UFormField>
    </section>

    <section class="space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="font-medium">{{ t('dtb.roles') }}</h3>
        <UButton size="xs" variant="ghost" icon="i-lucide-undo-2" :disabled="!Object.keys(overrides).length" @click="reset">{{ t('dtb.reset') }}</UButton>
      </div>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label
          v-for="role in roles"
          :key="role"
          class="flex min-h-11 items-center gap-3 ds-card px-3 py-2"
          :class="overrides[role] ? 'border-primary' : ''"
        >
          <input
            type="color"
            class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            :value="current(role).slice(0, 7)"
            :aria-label="role"
            @input="setColor(role, ($event.target as HTMLInputElement).value)"
          >
          <span class="min-w-0 flex-1">
            <span class="block font-mono text-xs">{{ role }}</span>
            <span class="block font-mono text-xs text-muted">{{ current(role) }}<template v-if="!overrides[role]"> · {{ t('dtb.fromBase') }}</template></span>
          </span>
        </label>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="font-medium">{{ t('dtb.contrast') }}</h3>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[30rem] text-left text-sm">
          <thead class="text-xs text-muted">
            <tr><th class="pr-3">{{ t('dtb.pair') }}</th><th class="pr-3">{{ t('dtb.sample') }}</th><th class="pr-3">{{ t('dtb.ratio') }}</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.pair.join('/')" class="border-t border-default">
              <td class="py-1.5 pr-3 font-mono text-xs">{{ row.pair[0] }} / {{ row.pair[1] }}</td>
              <td class="py-1.5 pr-3">
                <span class="inline-block rounded px-3 py-1 text-sm" :style="{ backgroundColor: row.bg, color: row.fg }">Aa {{ t('dt.sample.short') }}</span>
              </td>
              <td class="py-1.5 pr-3" :class="row.ok ? 'text-success' : 'font-semibold text-error'">
                {{ row.ratio }}:1 <span class="text-xs font-normal text-muted">/ {{ row.min }}:1</span>
              </td>
              <td class="py-1.5 text-right">
                <UButton
                  v-if="!row.ok"
                  size="xs"
                  variant="soft"
                  @click="fix(current(row.pair[0]), current(row.pair[1]), row.min, row.pair[0])"
                >
                  {{ t('dtb.fix') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="practice.length" class="space-y-1">
      <h3 class="font-medium">{{ t('dtb.practice') }}</h3>
      <p v-for="line in practice" :key="line" class="text-sm text-warning">{{ line }}</p>
    </section>

    <section class="space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="font-medium">{{ t('dtb.block') }}</h3>
        <UButton size="xs" variant="ghost" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy">{{ t('common.copy') }}</UButton>
      </div>
      <pre class="max-h-72 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ block }}</pre>

      <p v-for="problem in problems" :key="problem" class="text-sm text-warning">{{ t(problemText[problem] ?? problem) }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <UButton :loading="creating" :disabled="problems.length > 0" icon="i-lucide-file-plus" @click="createDraft">
          {{ t('dtb.create') }}
        </UButton>
        <NuxtLink v-if="createdId" :to="`/projects/${projectId}/records/${createdId}`" class="text-sm hover:underline">
          {{ t('dtb.created', { id: createdId }) }}
        </NuxtLink>
      </div>
      <p class="text-xs text-muted">{{ t('dtb.note') }}</p>
      <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />
    </section>
  </div>
</template>
