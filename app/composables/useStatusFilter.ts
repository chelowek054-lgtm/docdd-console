/**
 * Вкладка статуса живёт в адресе (`?status=draft`): ссылка на «черновики
 * требований» ведёт на них (docs/04-ui.md, «Списки по статусам»). Пустая
 * строка — «Все». Статус, которого в списке нет (устаревшая ссылка), — тоже
 * «Все», а не пустой экран.
 */
export function useStatusFilter(statuses: MaybeRefOrGetter<readonly string[]>) {
  const route = useRoute();
  const router = useRouter();

  return computed<string>({
    get: () => {
      const value = route.query['status'];
      return typeof value === 'string' && toValue(statuses).includes(value) ? value : '';
    },
    set: (value) => {
      const { status: _dropped, ...rest } = route.query;
      router.replace({ query: value ? { ...rest, status: value } : rest });
    }
  });
}
