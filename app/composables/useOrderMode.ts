import type { IndexRecord } from '~~/server/lib/types';
import { hasRanks, type OrderMode } from '~~/server/lib/work-order';

/**
 * Порядок списков «Работы»: «по важности» по умолчанию, пока у фаз есть `rank`, и «по номеру»,
 * если человек так выбрал (`?order=id`) или порядка по важности ещё нет
 * (docs/04-ui.md, «Порядок по важности»).
 */
export function useOrderMode(records: MaybeRefOrGetter<readonly IndexRecord[]>) {
  const route = useRoute();
  const router = useRouter();

  const ranked = computed(() => hasRanks(toValue(records)));
  const mode = computed<OrderMode>(() => (route.query['order'] === 'id' || !ranked.value ? 'id' : 'importance'));

  function set(next: OrderMode) {
    const { order: _dropped, ...rest } = route.query;
    router.replace({ query: next === 'id' ? { ...rest, order: 'id' } : rest });
  }

  return { mode, ranked, set };
}
