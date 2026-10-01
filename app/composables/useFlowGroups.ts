import type { Ref } from 'vue';

import type { ProjectMap } from '~~/server/lib/maps';
import {
  bucketsOf, dataflowOverviewMermaid, flowGroupResolver, scopeDataflow
} from '~/utils/dataflow-groups';
import { groupCardOf } from '~/utils/group-mermaid';
import { dataflowMermaid } from '~/utils/map-mermaid';
import { GROUPS_THRESHOLD, type useCodeGroups } from './useCodeGroups';

/**
 * Потоки данных по тем же группам, что и кодовая карта (docs/04-ui.md, «Группы
 * кодовой карты»): обзор «группы ↔ хранилища и внешние системы», а внутри
 * группы кода или свёртки источников — нынешняя детализация. Открытая группа
 * общая с кодовой картой (`?group=`), открытая свёртка источников — `?bucket=`.
 */

export type FlowMode = 'groups' | 'flows';

export function useFlowGroups(
  map: Ref<ProjectMap | null | undefined>,
  code: ReturnType<typeof useCodeGroups>
) {
  const route = useRoute();
  const router = useRouter();

  const data = computed(() => map.value?.dataflow ?? { sources: [], flows: [] });
  const buckets = computed(() => bucketsOf(data.value));

  const openBucket = computed<string | null>(() => {
    const id = route.query['bucket'];
    return typeof id === 'string' && buckets.value.some((bucket) => bucket.id === id) ? id : null;
  });

  /**
   * Явный выбор человека; пока его нет, решает размер — производное состояние,
   * как у кодовой карты: гидратация должна совпасть с серверной отрисовкой.
   */
  const chosen = ref<FlowMode | null>(null);
  const mode = computed<FlowMode>(() => {
    if (chosen.value) return chosen.value;
    if (code.openGroup.value || openBucket.value) return 'groups';
    return data.value.flows.length > GROUPS_THRESHOLD && code.groupsAvailable.value ? 'groups' : 'flows';
  });

  const groupOfFlow = computed(() => flowGroupResolver(code.model.value, map.value?.codemap.modules ?? []));

  /** Открыть группу кода или свёртку источников; пусто — вернуться на обзор. */
  async function open(target: { group?: string | null; bucket?: string | null } = {}) {
    const query = { ...route.query };
    delete query['group'];
    delete query['bucket'];
    if (target.group) query['group'] = target.group;
    if (target.bucket) query['bucket'] = target.bucket;
    await router.replace({ query });
  }

  async function chooseMode(next: FlowMode) {
    chosen.value = next;
    if (next === 'flows') await open();
  }

  const titleOf = (id: string) => code.model.value.groups.find((group) => group.id === id)?.title ?? id;
  const cardOf = (id: string) => {
    const group = code.model.value.groups.find((item) => item.id === id);
    return group ? groupCardOf(code.model.value, group, code.modulesById.value, code.capabilities.value) : undefined;
  };

  /** Диаграмма потоков: все разом, обзор или нынешняя детализация, суженная до группы или свёртки. */
  function view(value: ProjectMap) {
    if (mode.value === 'flows') return dataflowMermaid(value);
    if (code.openGroup.value) {
      return dataflowMermaid({
        ...value,
        dataflow: scopeDataflow(value.dataflow, { group: code.openGroup.value }, groupOfFlow.value)
      });
    }
    if (openBucket.value) {
      return dataflowMermaid({
        ...value,
        dataflow: scopeDataflow(value.dataflow, { bucket: openBucket.value }, groupOfFlow.value)
      });
    }
    return dataflowOverviewMermaid(value.dataflow, groupOfFlow.value, { titleOf, cardOf });
  }

  return { mode, buckets, openBucket, open, chooseMode, view };
}
