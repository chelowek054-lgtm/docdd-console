/**
 * Отметки в списке (docs/04-ui.md, «Массовые действия»). Отмеченным считается
 * только то, что сейчас на экране: запись, ушедшая из списка под другим
 * фильтром, из отмеченных выпадает — переводить невидимое приложение не станет.
 */
export function useSelection<T extends { id: string }>(items: MaybeRefOrGetter<readonly T[]>) {
  const chosen = ref<string[]>([]);

  // Список сменился (фильтр, вкладка) — отметки на ушедших записях снимаются
  // совсем, а не прячутся: иначе они вернулись бы при возврате на вкладку.
  watch(() => toValue(items).map((item) => item.id).join(','), () => {
    const visible = new Set(toValue(items).map((item) => item.id));
    const kept = chosen.value.filter((id) => visible.has(id));
    if (kept.length !== chosen.value.length) chosen.value = kept;
  });

  const selected = computed(() => toValue(items).filter((item) => chosen.value.includes(item.id)));
  const count = computed(() => selected.value.length);

  /** Для флажка «выбрать всё»: все, часть или никто. */
  const state = computed<boolean | 'indeterminate'>(() => {
    const total = toValue(items).length;
    if (count.value === 0 || total === 0) return false;
    return count.value === total ? true : 'indeterminate';
  });

  function has(id: string): boolean {
    return chosen.value.includes(id);
  }

  function set(id: string, on: boolean | 'indeterminate') {
    const rest = chosen.value.filter((item) => item !== id);
    chosen.value = on === true ? [...rest, id] : rest;
  }

  /** Отмечено всё на экране — снимает; иначе (и при части) — отмечает всё. */
  function toggleAll() {
    chosen.value = state.value === true ? [] : toValue(items).map((item) => item.id);
  }

  function clear() {
    chosen.value = [];
  }

  return { selected, count, state, has, set, toggleAll, clear };
}
