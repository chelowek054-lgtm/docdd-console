<script setup lang="ts">
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { failure, records } = useProjectIndex(projectId);

const onlyDangling = ref(false);

const layout = computed(() => layoutGraph(records.value));

const shown = computed(() => (onlyDangling.value
  ? layout.value.nodes.filter((node) => node.dangling)
  : layout.value.nodes));

const shownIds = computed(() => new Set(shown.value.map((node) => node.id)));

const edges = computed(() => (onlyDangling.value
  ? []
  : layout.value.edges.filter((edge) => shownIds.value.has(edge.from) && shownIds.value.has(edge.to))));

const dangling = computed(() => layout.value.nodes.filter((node) => node.dangling));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Граф</h1>
        <!-- Узлов может быть меньше, чем записей: занятый дважды идентификатор
             даёт один узел, а о самом дубле говорит id_duplicate. -->
        <p class="text-sm text-muted">{{ layout.nodes.length }} узлов, {{ layout.edges.length }} связей</p>
        <UButton
          class="ml-auto"
          size="sm"
          :variant="onlyDangling ? 'solid' : 'outline'"
          :color="dangling.length ? 'warning' : 'neutral'"
          @click="onlyDangling = !onlyDangling"
        >
          Висящие узлы: {{ dangling.length }}
        </UButton>
      </div>

      <p class="text-sm text-muted">
        Колонка — тип записи, цвет — тоже тип, форма — статус. Рёбра идут слева
        направо: требование ← задача ← проверка. Узел без единой связи подсвечен
        — это запись, о которой забыли.
      </p>

      <div v-if="layout.nodes.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Записей в проекте нет — рисовать нечего.
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default p-2">
        <svg
          :width="layout.width"
          :height="layout.height"
          :viewBox="`0 0 ${layout.width} ${layout.height}`"
          role="img"
          aria-label="Граф записей проекта"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ui-border-accented)" />
            </marker>
          </defs>

          <text
            v-for="column in layout.columns"
            :key="column.title"
            :x="column.x"
            :y="16"
            class="fill-[var(--ui-text-muted)] text-xs"
          >{{ column.title }}</text>

          <path
            v-for="(edge, at) in edges"
            :key="`${edge.from}-${edge.kind}-${edge.to}-${at}`"
            :d="`M ${edge.x1} ${edge.y1} C ${(edge.x1 + edge.x2) / 2} ${edge.y1}, ${(edge.x1 + edge.x2) / 2} ${edge.y2}, ${edge.x2} ${edge.y2}`"
            fill="none"
            stroke="var(--ui-border-accented)"
            stroke-width="1"
            marker-end="url(#arrow)"
          />

          <g v-for="node in shown" :key="node.id">
            <!-- Узел — ссылка на запись: без перехода граф был бы картинкой. -->
            <NuxtLink :to="`/projects/${projectId}/records/${node.id}`">
              <rect
                :x="node.x"
                :y="node.y"
                :width="NODE_WIDTH"
                :height="NODE_HEIGHT"
                :rx="nodeShape(node.status).rx"
                :fill="node.dangling ? 'var(--ui-bg-elevated)' : 'var(--ui-bg)'"
                :stroke="TYPE_COLORS[node.type] ?? 'var(--ui-border)'"
                :stroke-width="node.dangling ? 2 : 1.5"
                :stroke-dasharray="nodeShape(node.status).dashed ? '4 3' : undefined"
              />
              <text :x="node.x + 10" :y="node.y + 18" class="fill-[var(--ui-text)] text-[11px] font-mono">
                {{ node.id }}
                <tspan v-if="node.dangling" class="fill-[var(--ui-color-warning-500)]"> · висит</tspan>
              </text>
              <text :x="node.x + 10" :y="node.y + 33" class="fill-[var(--ui-text-muted)] text-[11px]">
                {{ node.title.length > 24 ? `${node.title.slice(0, 23)}…` : node.title }}
              </text>
            </NuxtLink>
          </g>
        </svg>
      </div>

      <div v-if="onlyDangling && dangling.length === 0" class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted">
        Висящих узлов нет: каждая запись с чем-то связана.
      </div>
    </template>
  </div>
</template>
