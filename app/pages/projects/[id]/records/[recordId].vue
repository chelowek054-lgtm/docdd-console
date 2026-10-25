<script setup lang="ts">
import type { LinkKind } from '~~/server/lib/types';
import type { IndexRecord } from '~~/server/lib/types'; import { VERIFICATION_FIELDS } from '~~/server/lib/verify-desk';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const recordId = computed(() => String(route.params['recordId'] ?? '')); const { t, locale } = useT();

const { detail, failure, refresh } = useRecord(projectId, recordId);
const { byId, index, patchRecord } = useProjectIndex(projectId);

/** После действия перечитываем и запись, и индекс: статус меняет обе картины. */
async function reload(record?: IndexRecord) {
  if (record) patchRecord(record);
  await refresh();
}

const LINK_LABELS = computed<Record<LinkKind, string>>(() => ({
  implements: t('rec.lnk.implements'),
  refines: t('rec.lnk.refines'),
  decided_by: t('rec.lnk.decided_by'),
  supersedes: t('rec.lnk.supersedes'),
  depends_on: t('rec.lnk.depends_on'),
  verified_by: t('rec.lnk.verified_by'),
  verifies: t('rec.lnk.verifies'),
  documents: t('rec.lnk.documents'),
  covers: t('rec.lnk.covers'),
  reuses: t('rec.lnk.reuses')
}));

const BACKLINK_LABELS = computed<Record<LinkKind, string>>(() => ({
  implements: t('rec.blnk.implements'),
  refines: t('rec.blnk.refines'),
  decided_by: t('rec.blnk.decided_by'),
  supersedes: t('rec.blnk.supersedes'),
  depends_on: t('rec.blnk.depends_on'),
  verified_by: t('rec.blnk.verified_by'),
  verifies: t('rec.blnk.verifies'),
  documents: t('rec.blnk.documents'),
  covers: t('rec.blnk.covers'),
  reuses: t('rec.blnk.reuses')
}));

const links = computed(() => entries(detail.value?.record.links ?? {}, LINK_LABELS.value));
const backlinks = computed(() => entries(detail.value?.record.backlinks ?? {}, BACKLINK_LABELS.value));

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

const extraFields = computed(() => Object.entries(detail.value?.record.extra ?? {}).filter(([key]) => !(detail.value?.record.type === 'verification' && VERIFICATION_FIELDS.has(key)))); // поля контракта проверки показывает «Как проверить»

const VERDICTS = computed<Record<string, { label: string; color: BadgeColor }>>(() => ({
  ok: { label: t('rec.verdict.ok'), color: 'success' },
  pending: { label: t('rec.verdict.pending'), color: 'neutral' },
  missing: { label: t('rec.verdict.missing'), color: 'error' },
  stale: { label: t('rec.verdict.stale'), color: 'error' },
  still_present: { label: t('rec.verdict.still_present'), color: 'error' }
}));

/** Блоки из текста рисует сам текст; отдельной карточкой — только файлы `.mmd`. */
const fileDiagrams = computed(() => (detail.value?.diagrams ?? []).filter((diagram) => diagram.kind === 'file'));

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
        <StatusBadge :status="detail.record.status" :type="detail.record.type" />
      </div>

      <p class="text-sm text-muted">
        {{ t('rec.file') }} <span class="font-mono">{{ detail.record.path }}</span>
        <template v-if="detail.record.updated"> · {{ t('rec.changed') }} {{ detail.record.updated }}</template>
        <template v-if="detail.record.owner"> · {{ detail.record.owner }}</template>
      </p>

      <RecordDiff :project-id="projectId" :record-id="recordId" :status="detail.record.status" />

      <RecordActions
        :project-id="projectId"
        :record-id="recordId"
        :actions="detail.actions"
        :roles="index?.project.roles ?? []"
        @changed="reload"
      />

      <RecordDiscussion :project-id="projectId" :record-id="recordId" /> <RecordAsk :project-id="projectId" :record-id="recordId" /><!-- Справочник: feature без reuses — выбрать справку или записать «подходящего нет» (docs/13-reference.md). --> <RecordCriteria v-if="detail.record.type === 'requirement'" :project-id="projectId" :record-id="recordId" :body="detail.body" :records="index?.records ?? []" @created="refresh" />
      <TaskReuse
        v-if="detail.record.type === 'task'"
        :project-id="projectId"
        :task="detail.record"
        :records="index?.records ?? []"
        @changed="reload"
      />

      <!-- Привести задачу в порядок: нет `implements` — выбрать или завести требование тут же (docs/04-ui.md, «Запись»). -->
      <TaskRequirement
        v-if="detail.record.type === 'task'"
        :project-id="projectId"
        :task="detail.record"
        :actions="detail.actions"
        :records="index?.records ?? []"
        @changed="reload"
      />

      <!-- Кто принимает задачу: явно или по правилу (docs/adr/0030-task-reviewer.md). -->
      <TaskReviewer
        v-if="detail.record.type === 'task'"
        :project-id="projectId"
        :task="detail.record"
        :records="index?.records ?? []"
        :roles="index?.project.roles ?? []"
        @changed="reload"
      />

      <TaskAssignee
        v-if="detail.record.type === 'task'"
        :project-id="projectId"
        :task="detail.record"
        @changed="reload"
      />

      <!-- Срок, оценка и факт по журналу (ADR-0039). -->
      <TaskTiming v-if="detail.record.type === 'task'" :project-id="projectId" :task="detail.record" @changed="reload" />

      <!-- Прежний курс (A-0001): новое требование — черновиком, старое не трогаем. -->
      <LegacyRevive
        v-if="detail.record.type === 'requirement' && detail.record.status === 'legacy'"
        :project-id="projectId"
        :record-id="recordId"
        :legacy-by="typeof detail.record.extra['legacy_by'] === 'string' ? detail.record.extra['legacy_by'] : null"
      />

      <!-- Ручная проверка: флажок «Проверено» фиксирует прогон (docs/04-ui.md). -->
      <!-- Карточка «Как проверить»: способ, что проверяет, история прогонов (docs/04-ui.md, «Карточка проверки»). -->
      <VerificationCard
        v-if="detail.record.type === 'verification'"
        :project-id="projectId"
        :record="detail.record"
        :index="index"
        @changed="reload"
      />
      <!-- Внутри — прежние «Проверено» и «Дефект из провала»: -->
      <!-- ручную проверку прогоняет только человек, -->
      <!-- провал автоматической превращается в дефект одной кнопкой. -->
      <!-- Данные — из индекса: отчёты, связи, задачи требования. -->
      <!-- Сам текст проверки (шаги) — ниже, в «Тексте документа». -->

      <UCard v-if="detail.map">
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">{{ t('rec.structChange') }}</h2>
            <p class="text-sm text-muted">
              {{ detail.map.structures.length ? detail.map.structures.join(', ') : t('rec.noStructures') }}
            </p>
          </div>
        </template>

        <UAlert
          v-for="(problem, at) in detail.map.problems"
          :key="at"
          class="mb-3"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="t('rec.mapUnparsed')"
          :description="problem.message"
        />

        <p v-if="detail.map.claims.length === 0" class="text-sm text-muted">
          {{ t('rec.noClaims') }}

        </p>

        <ul v-else class="divide-y divide-default">
          <li v-for="(claim, at) in detail.map.claims" :key="at" class="flex flex-wrap items-center gap-3 py-2">
            <UBadge :color="claim.side === 'added' ? 'primary' : 'neutral'" variant="subtle" size="sm">
              {{ claim.side === 'added' ? t('rec.added') : t('rec.removed') }}
            </UBadge>
            <span class="font-mono text-xs">{{ claim.label }}</span>
            <span class="text-xs text-muted">{{ claim.path }}:{{ claim.line }}</span>
            <UBadge
              class="ml-auto"
              :color="VERDICTS[claim.verdict]?.color ?? 'neutral'"
              variant="subtle"
              size="sm"
            >{{ VERDICTS[claim.verdict]?.label ?? claim.verdict }}</UBadge>
          </li>
        </ul>
      </UCard>

      <TaskWork
        v-if="detail.record.type === 'task'"
        :project-id="projectId"
        :record-id="recordId"
        :status="detail.record.status"
        :roles="index?.project.roles ?? []"
        @changed="reload"
      />

      <div v-if="detail.issues.length" class="space-y-2">
        <h2 class="font-medium">{{ t('rec.problems') }}</h2>
        <IssueList :project-id="projectId" :issues="detail.issues" />
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <BodyEditor
            :project-id="projectId"
            :record-id="recordId"
            :body="detail.body"
            :status="detail.record.status"
            :roles="index?.project.roles ?? []"
            @changed="reload"
          />

          <UCard v-if="fileDiagrams.length">
            <template #header>
              <h2 class="font-medium">{{ t('rec.diagrams') }}</h2>
            </template>
            <p class="mb-3 text-sm text-muted">
              {{ t('rec.diagFiles') }} <code>.mmd</code>{{ t('rec.diagFiles2') }}

            </p>
            <div v-for="(diagram, at) in fileDiagrams" :key="at" class="mb-3">
              <p class="text-xs text-muted">
                {{ diagram.path }}<span v-if="diagram.caption"> · {{ diagram.caption }}</span>
              </p>
              <UAlert
                v-if="diagram.error"
                color="warning"
                variant="subtle"
                :title="diagram.error"
                :description="t('rec.diagramErr')"
              />
              <MermaidDiagram v-else :source="diagram.source" :id="`file-${at}`" />
            </div>
          </UCard>
        </div>

        <div class="space-y-4">
          <UCard>
            <template #header>
              <h2 class="font-medium">{{ t('rec.links') }}</h2>
            </template>

            <p v-if="links.length === 0 && backlinks.length === 0" class="text-sm text-muted">
              {{ t('rec.noLinks') }}
            </p>

            <div v-for="group in links" :key="`out:${group.kind}`" class="mb-3">
              <p class="text-xs uppercase tracking-wide text-muted">{{ group.label }}</p>
              <ul class="mt-1 space-y-1">
                <li v-for="id in group.ids" :key="id">
                  <RecordLink :project-id="projectId" :record-id="id" :record="index ? (byId.get(id) ?? null) : undefined" />
                </li>
              </ul>
            </div>

            <div v-if="backlinks.length" class="border-t border-default pt-3">
              <p class="mb-2 text-xs text-muted">{{ t('rec.backlinks') }}</p>
              <div v-for="group in backlinks" :key="`in:${group.kind}`" class="mb-3">
                <p class="text-xs uppercase tracking-wide text-muted">{{ group.label }}</p>
                <ul class="mt-1 space-y-1">
                  <li v-for="id in group.ids" :key="id">
                    <RecordLink :project-id="projectId" :record-id="id" :record="index ? (byId.get(id) ?? null) : undefined" />
                  </li>
                </ul>
              </div>
            </div>
          </UCard>

          <UCard v-if="Object.keys(detail.verifications).length">
            <template #header>
              <h2 class="font-medium">{{ t('rec.runs') }}</h2>
            </template>
            <ul class="space-y-2 text-sm">
              <li v-for="(outcome, id) in detail.verifications" :key="id" class="flex items-center justify-between gap-2">
                <span class="font-mono text-xs">{{ id }}</span>
                <span class="text-muted">{{ new Date(outcome.at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ru-RU') }} · {{ outcome.runner }}</span>
                <UBadge :color="statusColor(outcome.state)" variant="subtle" size="sm">
                  {{ resultLabel(outcome.state) }}
                </UBadge>
              </li>
            </ul>
          </UCard>

          <UCard v-if="journal.length">
            <template #header>
              <h2 class="font-medium">{{ t('rec.journal') }}</h2>
            </template>
            <ul class="space-y-1 text-sm text-muted">
              <li v-for="(line, at) in journal" :key="at">{{ line }}</li>
            </ul>
          </UCard>

          <UCard v-if="extraFields.length">
            <template #header>
              <h2 class="font-medium">{{ t('rec.projectFields') }}</h2>
            </template>
            <p class="mb-2 text-xs text-muted">
              {{ t('rec.extraHint') }}
            </p>
            <dl class="space-y-1 text-sm">
              <div v-for="[key, value] in extraFields" :key="key" class="flex gap-2">
                <dt class="font-mono text-xs text-muted">{{ key }}</dt>
                <dd class="min-w-0 break-words">{{ value }}</dd>
              </div>
            </dl>
          </UCard><UCard v-if="detail.record.type === 'task' && detail.record.status === 'done' && (detail.record.backlinks.ships?.length ?? 0) > 0"><template #header><h2 class="font-medium">{{ t('rec.release') }}</h2></template><p v-for="id in detail.record.backlinks.ships" :key="id" class="text-sm"><RecordLink :project-id="projectId" :record-id="id" :record="index ? (byId.get(id) ?? null) : undefined" /></p></UCard>
        </div>
      </div>
    </template>
  </div>
</template>
