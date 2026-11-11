import type { DomainState } from '../domain/model';

/**
 * Доменная карта коротким текстом для запросов модели (R-0121): куда класть код,
 * какими словами называть и что охраняет корень агрегата. Пустая карта — пустая строка.
 */
export function domainText(domain: DomainState): string {
  if (domain.contexts.length === 0) return '';
  const lines: string[] = [];
  for (const context of domain.contexts) {
    lines.push(`- Контекст \`${context.id}\`${context.title ? ` «${context.title}»` : ''}${context.kind ? ` (${context.kind})` : ''}${context.root ? `, корень \`${context.root}\`` : ''}${context.capabilities?.length ? `; возможности: ${context.capabilities.join(', ')}` : ''}`);
    const terms = context.language ?? [];
    if (terms.length) lines.push(`  - словарь: ${terms.map((item) => `${item.term}${item.code ? ` = \`${item.code}\`` : ''}${item.meaning ? ` (${item.meaning})` : ''}`).join('; ')}`);
    for (const aggregate of domain.aggregates.filter((item) => item.context === context.id)) {
      const parts = [
        aggregate.root ? `корень \`${aggregate.root}\`` : '',
        aggregate.invariants?.length ? `инварианты: ${aggregate.invariants.join('; ')}` : '',
        aggregate.valueObjects?.length ? `объекты-значения: ${aggregate.valueObjects.join(', ')}` : '',
        aggregate.policies?.length ? `политики: ${aggregate.policies.join(', ')}` : ''
      ].filter(Boolean);
      lines.push(`  - агрегат \`${aggregate.id}\`${aggregate.title ? ` «${aggregate.title}»` : ''}${parts.length ? ` — ${parts.join('; ')}` : ''}`);
    }
  }
  for (const relation of domain.relations) lines.push(`- Связь: \`${relation.from}\` → \`${relation.to}\` (${relation.kind})`);
  return lines.join('\n');
}
