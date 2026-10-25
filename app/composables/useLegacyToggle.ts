/**
 * «Показать legacy» (A-0001): записи прежнего курса списки по умолчанию скрывают.
 * Переключатель живёт в адресе (`?legacy=1`), как вкладка статуса.
 */
export function useLegacyToggle() {
  const route = useRoute();
  const router = useRouter();
  return computed<boolean>({
    get: () => route.query['legacy'] === '1',
    set: (value) => {
      const { legacy: _dropped, ...rest } = route.query;
      router.replace({ query: value ? { ...rest, legacy: '1' } : rest });
    }
  });
}
