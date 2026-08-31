<script setup lang="ts">
import type { LinkKind } from '~~/server/lib/types';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const recordId = computed(() => String(route.params['recordId'] ?? ''));

const { detail, failure } = useRecord(projectId, recordId);
const { byId } = useProjectIndex(projectId);

const LINK_LABELS: Record<LinkKind, string> = {
  implements: 'выполняет требование',
  refines: 'уточняет',
  decided_by: 'опирается на решение',
  supersedes: 'заменяет',
  depends_on: 'зависит от',
  verified_by: 'проверяется',
  verifies: 'проверяет',
  documents: 'правит документ',
  covers: 'состав'
};

const BACKLINK_LABELS: Record<LinkKind, string> = {
  implements: 'выполняется задачами',
  refines: 'уточняется',
  decided_by: 'на решение опираются',
  supersedes: 'заменено записью',
  depends_on: 'от него зависят',
  verified_by: 'проверяет',
  verifies: 'проверяется',
  documents: 'правится задачами',
  covers: 'входит в фазу'
};

const links = computed(() => entries(detail.value?.record.links ?? {}, LINK_LABELS));
const backlinks = computed(() => entries(detail.value?.record.backlinks ?? {}, BACKLINK_LABELS));

/** Журнал — часть тела документа; приложение его читает, но не переписывает. */
const journal = computed(() => {
  const body = detail.value?.body ?? '';
  const at = body.search(/^##\s+Журнал\s*$/m);
  if (at === -1) return [];
  return body
    .slice(at)
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.trim().slice(2));
});

const bodyWithoutJournal = computed(() => {
  const body = detail.value?.body ?? '';
  const at = body.search(/^##\s+Журнал\s*$/m);
  return at === -1 ? body : body.slice(0, at);
});

const extraFields = computed(() => Object.entries(detail.value?.record.extra ?? {}));

function entries(
  source: Partial<Record<LinkKind, string[]>>,
  labels: Record<LinkKind, string>
): { kind: LinkKind; label: string; ids: string[] }[] {
  return (Object.keys(source) as LinkKind[])
    .filter((kind) => (source[kind]?.length ?? 0) > 0)
    .map((kind) => ({ kind, label: labels[kind], ids: source[kind] ?? [] }));
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else-if="detail">
      <div class="flex flex-wrap items-center gap-3">
        <span class="font-mono text-sm text-muted">{{ detail.record.id }}</span>
        <h1 class="text-xl font-semibold">{{ detail.record.title }}</h1>
        <UBadge color="neutral" variant="subtle">{{ typeLabel(detail.record.type) }}</UBadge>
        <StatusBadge :status="detail.record.status" />
      </div>

      <!-- Действий пока нет: смена статуса приходит в фазе 3. Врать неактивной
           кнопкой раньше времени незачем. -->
      <p class="text-sm text-muted">
        Файл <span class="font-mono">{{ detail.record.path }}</span>
        <template v-if="detail.record.updated"> · изменён {{ detail.record.updated }}</template>
        <template v-if="detail.record.owner"> · {{ detail.record.owner }}</template>
      </p>

      <div v-if="detail.issues.length" class="space-y-2">
        <h2 class="font-medium">Что не так с этой записью</h2>
        <IssueList :project-id="projectId" :issues="detail.issues" />
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <UCard>
            <template #header>
              <h2 class="font-medium">Текст документа</h2>
            </template>
            <!-- Разметка markdown приходит в фазе 4 вместе с диаграммами; пока
                 текст показывается как есть, чтобы ничего не потерять. -->
            <pre class="whitespace-pre-wrap break-words text-sm">{{ bodyWithoutJournal.trim() }}</pre>
          </UCard>

          <UCard v-if="detail.diagrams.length">
            <template #header>
              <h2 class="font-medium">Диаграммы</h2>
            </template>
            <p class="mb-3 text-sm text-muted">
              Найдено {{ plural(detail.diagrams.length, 'диаграмма', 'диаграммы', 'диаграмм') }}.
              Отрисовка появится в фазе 4 — пока виден исходный текст.
            </p>
            <div v-for="(diagram, at) in detail.diagrams" :key="at" class="mb-3">
              <p class="text-xs text-muted">
                {{ diagram.kind === 'inline' ? 'блок в документе' : diagram.path }}
                <span v-if="diagram.caption"> · {{ diagram.caption }}</span>
              </p>
              <UAlert
                v-if="diagram.error"
                color="warning"
                variant="subtle"
                :title="diagram.error"
                description="Ошибка диаграммы не мешает читать документ."
              />
              <pre v-else class="mt-1 overflow-x-auto rounded bg-elevated p-3 text-xs">{{ diagram.source }}</pre>
            </div>
          </UCard>
        </div>

        <div class="space-y-4">
          <UCard>
            <template #header>
              <h2 class="font-medium">Связи</h2>
            </template>

            <p v-if="links.length === 0 && backlinks.length === 0" class="text-sm text-muted">
              Запись ни с чем не связана. В графе это висящий узел.
            </p>

            <div v-for="group in links" :key="`out:${group.kind}`" class="mb-3">
              <p class="text-xs uppercase tracking-wide text-muted">{{ group.label }}</p>
              <ul class="mt-1 space-y-1">
                <li v-for="id in group.ids" :key="id">
                  <RecordLink :project-id="projectId" :record-id="id" :record="byId.get(id) ?? null" />
                </li>
              </ul>
            </div>

            <div v-if="backlinks.length" class="border-t border-default pt-3">
              <p class="mb-2 text-xs text-muted">Обратные связи строит приложение — в файле их нет.</p>
              <div v-for="group in backlinks" :key="`in:${group.kind}`" class="mb-3">
                <p class="text-xs uppercase tracking-wide text-muted">{{ group.label }}</p>
                <ul class="mt-1 space-y-1">
                  <li v-for="id in group.ids" :key="id">
                    <RecordLink :project-id="projectId" :record-id="id" :record="byId.get(id) ?? null" />
                  </li>
                </ul>
              </div>
            </div>
          </UCard>

          <UCard v-if="Object.keys(detail.verifications).length">
            <template #header>
              <h2 class="font-medium">Прогоны</h2>
            </template>
            <ul class="space-y-2 text-sm">
              <li v-for="(outcome, id) in detail.verifications" :key="id" class="flex items-center justify-between gap-2">
                <span class="font-mono text-xs">{{ id }}</span>
                <span class="text-muted">{{ new Date(outcome.at).toLocaleDateString('ru-RU') }} · {{ outcome.runner }}</span>
                <UBadge :color="statusColor(outcome.state)" variant="subtle" size="sm">
                  {{ RESULT_LABELS[outcome.state] }}
                </UBadge>
              </li>
            </ul>
          </UCard>

          <UCard v-if="journal.length">
            <template #header>
              <h2 class="font-medium">Журнал</h2>
            </template>
            <ul class="space-y-1 text-sm text-muted">
              <li v-for="(line, at) in journal" :key="at">{{ line }}</li>
            </ul>
          </UCard>

          <UCard v-if="extraFields.length">
            <template #header>
              <h2 class="font-medium">Поля проекта</h2>
            </template>
            <p class="mb-2 text-xs text-muted">
              Приложение их не понимает, но обязано вернуть и сохранить.
            </p>
            <dl class="space-y-1 text-sm">
              <div v-for="[key, value] in extraFields" :key="key" class="flex gap-2">
                <dt class="font-mono text-xs text-muted">{{ key }}</dt>
                <dd class="min-w-0 break-words">{{ value }}</dd>
              </div>
            </dl>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>
