import type { DomainState } from '../domain/model';

/**
 * Профиль слоёв практики DDD + Clean (R-0118). Встроенная практика объявляет его
 * блоком `docdd-rules` с `"profile": "ddd-clean"`; консоль применяет его к корню
 * каждого контекста доменной карты сама — как если бы проект написал `use`.
 */
export const DDD_PROFILE = 'ddd-clean';

export function profileUses(domain: DomainState): { profile: string; root: string; context: string }[] {
  const seen = new Set<string>();
  const uses: { profile: string; root: string; context: string }[] = [];
  for (const context of domain.contexts) {
    const root = context.root?.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (!root || seen.has(root)) continue;
    seen.add(root);
    uses.push({ profile: DDD_PROFILE, root, context: context.id });
  }
  return uses;
}
