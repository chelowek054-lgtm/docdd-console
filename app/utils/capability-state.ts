import type { CapabilityState } from '../../server/lib/functional';

/**
 * Как состояние реализации выглядит на экране: цвет, значок и полоса сводки.
 * Одни и те же значения у дерева, сводки и графа (docs/04-ui.md,
 * «Функциональная карта»), поэтому живут в одном месте. Классы написаны
 * целиком: Tailwind собирает только то, что видит в тексте.
 */
export const STATE_UI: Record<CapabilityState, {
  color: 'success' | 'warning' | 'error' | 'neutral';
  icon: string;
  bar: string;
}> = {
  implemented: { color: 'success', icon: 'i-lucide-circle-check', bar: 'bg-success' },
  partial: { color: 'warning', icon: 'i-lucide-circle-dot', bar: 'bg-warning' },
  not_implemented: { color: 'error', icon: 'i-lucide-circle-x', bar: 'bg-error' },
  unassessed: { color: 'neutral', icon: 'i-lucide-circle-dashed', bar: 'bg-accented' }
};
