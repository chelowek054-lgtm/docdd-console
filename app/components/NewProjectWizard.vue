<script setup lang="ts">
/**
 * Мастер нового проекта (R-0076, docs/04-ui.md, «Подключение»): вектор, первые
 * возможности с требованиями, глоссарий — и черновики записей до первой задачи.
 * «Подтвердить и подготовить» — решение человека: черновики получают подтверждение,
 * задачи — статус «готова к работе». Бриф можно положить во входящее и разобрать моделью.
 */
const props = defineProps<{ projectId: string }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const vision = reactive({ problem: '', audience: '', outcome: '', not: '' });
const features = ref('');
const glossary = ref('');
const phase = ref('');
const brief = ref('');

interface Created { id: string; type: string; title: string }
const created = ref<Created[]>([]);
const glossaryState = ref('');
const busy = ref(false);
const message = ref('');
const failure = ref('');

const FIELDS = ['problem', 'audience', 'outcome', 'not'] as const;
const featureCount = computed(() => features.value.split(/\r?\n/).filter((line) => line.trim()).length);

async function post<T>(path: string, body: unknown): Promise<T & { error?: { message: string } }> {
  return await $fetch<T & { error?: { message: string } }>(`/api/projects/${props.projectId}/${path}`, { method: 'POST', body, ignoreResponseError: true });
}

/** Шаг 1: черновики записей. */
async function create() {
  busy.value = true;
  failure.value = message.value = '';
  try {
    const response = await post<{ created: Created[]; problems: string[]; glossary: string }>('onboarding/wizard', { vision, features: features.value, glossary: glossary.value, phase: phase.value });
    if (response.error) { failure.value = response.error.message; return; }
    created.value = response.created;
    glossaryState.value = response.glossary;
    message.value = t('wz.created', { n: response.created.length });
    emit('changed');
  } finally {
    busy.value = false;
  }
}

const idsOf = (...types: string[]) => created.value.filter((item) => types.includes(item.type)).map((item) => item.id);

/** Шаг 2: подтверждение документов, затем задачи — «готова к работе». Порядок важен: задача ждёт подтверждённых документов. */
async function approve() {
  busy.value = true;
  failure.value = message.value = '';
  try {
    const docs = await post<{ results?: { id: string; ok?: boolean; message?: string }[] }>('records/bulk/status', { ids: idsOf('map', 'requirement', 'verification'), direction: 'approve' });
    if (docs.error) { failure.value = docs.error.message; return; }
    const tasks = await post<{ results?: { id: string; ok?: boolean; message?: string }[] }>('records/bulk/status', { ids: idsOf('task'), direction: 'forward' });
    if (tasks.error) { failure.value = tasks.error.message; return; }
    const bad = [...(docs.results ?? []), ...(tasks.results ?? [])].filter((row) => row.ok === false);
    message.value = bad.length ? t('wz.partial', { n: bad.length, why: bad[0]?.message ?? '' }) : t('wz.ready', { n: idsOf('task').length });
    emit('changed');
  } finally {
    busy.value = false;
  }
}

/** Бриф — во входящее: дальше его разбирает модель на вкладке «Входящее». */
async function sendBrief() {
  busy.value = true;
  failure.value = message.value = '';
  try {
    const response = await post<{ path?: string }>('inbox/notes', { title: t('wz.briefTitle'), body: brief.value });
    if (response.error) { failure.value = response.error.message; return; }
    message.value = t('wz.briefSent');
    brief.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-lucide-wand-sparkles" class="size-5 text-primary" />
        <h2 class="font-medium">{{ t('wz.title') }}</h2>
        <span class="text-sm text-muted">{{ t('wz.hint') }}</span>
      </div>
    </template>

    <div class="space-y-5 text-sm">
      <section class="space-y-2">
        <p class="font-medium">{{ t('wz.s1') }}</p>
        <UFormField v-for="field in FIELDS" :key="field" :label="t(`wz.vision.${field}`)"><UTextarea v-model="vision[field]" :rows="2" class="w-full" /></UFormField>
      </section>

      <section class="space-y-2">
        <p class="font-medium">{{ t('wz.s2') }}</p>
        <UFormField :label="t('wz.features')" :help="t('wz.featuresHelp')"><UTextarea v-model="features" :rows="5" class="w-full" :placeholder="t('wz.featuresExample')" /></UFormField>
        <UFormField :label="t('wz.phase')"><UInput v-model="phase" class="w-full sm:w-80" :placeholder="t('wz.phaseExample')" /></UFormField>
      </section>

      <section class="space-y-2">
        <p class="font-medium">{{ t('wz.s3') }}</p>
        <UFormField :label="t('wz.glossary')" :help="t('wz.glossaryHelp')"><UTextarea v-model="glossary" :rows="3" class="w-full" /></UFormField>
        <p class="text-xs text-muted">{{ t('wz.practices') }} <NuxtLink :to="`/projects/${projectId}/shared`" class="text-primary underline">{{ t('wz.practicesLink') }}</NuxtLink></p>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <UButton icon="i-lucide-file-plus" :loading="busy" :disabled="!vision.problem.trim() || featureCount === 0 || created.length > 0" @click="create">{{ t('wz.create') }}</UButton>
        <UButton v-if="created.length" icon="i-lucide-check-check" color="success" variant="soft" :loading="busy" @click="approve">{{ t('wz.approve') }}</UButton>
        <span v-if="message" class="text-muted">{{ message }}</span>
        <span v-if="failure" class="text-error">{{ failure }}</span>
      </div>
      <p v-if="glossaryState" class="text-xs text-muted">{{ t(`wz.glossaryState.${glossaryState}`) }}</p>

      <ul v-if="created.length" class="space-y-0.5 text-xs">
        <li v-for="item in created" :key="item.id" class="flex gap-2"><NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="font-mono hover:underline">{{ item.id }}</NuxtLink><span class="text-muted">{{ item.title }}</span></li>
      </ul>

      <section class="space-y-2 border-t border-default pt-4">
        <p class="font-medium">{{ t('wz.briefHead') }}</p>
        <UTextarea v-model="brief" :rows="3" class="w-full" :placeholder="t('wz.briefHelp')" />
        <UButton size="sm" variant="soft" icon="i-lucide-inbox" :loading="busy" :disabled="!brief.trim()" @click="sendBrief">{{ t('wz.briefSend') }}</UButton>
      </section>
    </div>
  </UCard>
</template>
