import type { Ref } from 'vue';

import { buildGroups, membersOf } from '~~/server/lib/groups';
import type { ProjectMap } from '~~/server/lib/maps';

/**
 * Кодовая база крупного проекта показывается тремя уровнями: обзор групп,
 * группа, выбранный модуль (docs/04-ui.md, «Группы кодовой карты»). Всё
 * состояние экрана — режим, открытая группа, выбранный модуль и слои — живёт
 * здесь, а `maps.vue` берёт готовую диаграмму.
 *
 * Слои работают так же, как работали на всей карте: чипы изолируют слой, а
 * порог крупной базы (docs/07-maps.md, «Крупная кодовая база») считается
 * теперь внутри группы, а не по всему проекту.
 */

/** Больше стольких модулей — обзор групп открывается сам: у малого проекта он только отнимает клик. */
export const GROUPS_THRESHOLD = 40;

/**
 * Крупная база — та, что при полной раскладке mermaid ощутимо подвешивает
 * вкладку (сотни модулей, тысячи пересечений линий). Порог приблизительный:
 * важно не точное число, а сам факт, что рисовать всё разом больше не бесплатно.
 */
export const LARGE_CODEMAP = 150;

export type CodeMode = 'groups' | 'modules';

export function useCodeGroups(map: Ref<ProjectMap | null | undefined>) {
  const route = useRoute();
  const router = useRouter();

  const modules = computed(() => map.value?.codemap.modules ?? []);
  const imports = computed(() => map.value?.codemap.imports ?? []);
  const modulesById = computed(() => new Map(modules.value.map((module) => [module.id, module])));
  const model = computed(() => buildGroups(modules.value, imports.value));

  /** Открытая группа держится в адресе: на неё можно послать ссылку. */
  const openGroup = computed<string | null>(() => {
    const id = route.query['group'];
    return typeof id === 'string' && model.value.groups.some((group) => group.id === id) ? id : null;
  });

  /**
   * Явный выбор человека. Пока его нет, решает размер проекта: производное, а не
   * хранимое состояние — отрисовка на сервере и на клиенте при гидратации должна
   * совпасть до последнего байта.
   */
  const chosenMode = ref<CodeMode | null>(null);
  const mode = computed<CodeMode>(() => {
    if (chosenMode.value) return chosenMode.value;
    if (openGroup.value) return 'groups';
    return modules.value.length > GROUPS_THRESHOLD && model.value.groups.length >= 2 ? 'groups' : 'modules';
  });
  /** Группы бывают не всегда: одна группа на весь проект обзора не стоит. */
  const groupsAvailable = computed(() => model.value.groups.length >= 2);

  /** Выбранный модуль: его соседи из других групп показаны призраками. */
  const focus = ref<string | null>(null);

  // --- слои: чипы изолируют слой; работают на том, что сейчас в области просмотра ---
  const chosenHiddenLayers = ref<Set<string> | null>(null);

  /** Модули в области просмотра: вся карта, одна группа или ничего (обзор рисует группы, не модули). */
  const scope = computed(() => {
    if (mode.value === 'modules') return modules.value;
    if (!openGroup.value) return [];
    const ids = new Set(membersOf(model.value, openGroup.value));
    return modules.value.filter((module) => ids.has(module.id));
  });

  const allLayers = computed(() => {
    const set = new Set<string>();
    for (const item of scope.value) set.add(item.layer ?? 'без слоя');
    return [...set].sort();
  });
  const isLarge = computed(() => scope.value.length > LARGE_CODEMAP);

  /** Самый маленький по числу модулей слой — с него начинают знакомство с крупной областью. */
  const smallestLayer = computed(() => {
    const sizes = new Map<string, number>();
    for (const item of scope.value) {
      const layer = item.layer ?? 'без слоя';
      sizes.set(layer, (sizes.get(layer) ?? 0) + 1);
    }
    return [...allLayers.value].sort((a, b) => (sizes.get(a) ?? 0) - (sizes.get(b) ?? 0))[0] ?? null;
  });

  const hiddenLayers = computed(() => {
    if (chosenHiddenLayers.value) return chosenHiddenLayers.value;
    if (!isLarge.value || !smallestLayer.value) return new Set<string>();
    return new Set(allLayers.value.filter((layer) => layer !== smallestLayer.value));
  });

  function toggleLayer(layer: string) {
    const isolated = hiddenLayers.value.size === allLayers.value.length - 1 && !hiddenLayers.value.has(layer);
    chosenHiddenLayers.value = isolated ? new Set() : new Set(allLayers.value.filter((item) => item !== layer));
  }

  /** Другая область — другие слои: прежний выбор чипов относился к прежней. */
  function resetScope() {
    focus.value = null;
    chosenHiddenLayers.value = null;
  }

  async function setOpenGroup(id: string | null) {
    resetScope();
    const query = { ...route.query };
    if (id === null) delete query['group'];
    else query['group'] = id;
    await router.replace({ query });
  }

  async function chooseMode(next: CodeMode) {
    chosenMode.value = next;
    resetScope();
    if (next === 'modules' && openGroup.value) await setOpenGroup(null);
  }

  /**
   * Кодовая база с вычетом скрытых слоёв — рёбра к спрятанному модулю тоже
   * прячутся (режим «Все модули»). Диаграмма строится заново на каждый клик по
   * чипу: слоёв на экране всегда один-два, поэтому пересборка дешёвая.
   */
  const filteredCodemap = computed(() => {
    const value = map.value;
    if (!value || hiddenLayers.value.size === 0) return value?.codemap;
    const visible = new Set(
      value.codemap.modules.filter((item) => !hiddenLayers.value.has(item.layer ?? 'без слоя')).map((item) => item.id)
    );
    return {
      modules: value.codemap.modules.filter((item) => visible.has(item.id)),
      imports: value.codemap.imports.filter((edge) => visible.has(edge.from) && visible.has(edge.to))
    };
  });

  return {
    model, modulesById, mode, groupsAvailable, openGroup, focus, chooseMode, setOpenGroup,
    allLayers, isLarge, hiddenLayers, toggleLayer, filteredCodemap, scopeCount: computed(() => scope.value.length)
  };
}
