/**
 * Подпись на заливке акцента берётся из токенов (`onAccent`), а не из общего
 * `--ui-text-inverted`: он парный к нейтральной кнопке и у светлой темы белый,
 * а белый на ярком зелёном не держит 4.5:1 (docs/16-design-system.md).
 * Настраивается темой самих компонентов Nuxt UI — стили снаружи не
 * переопределяются (ADR-0005).
 */
const onAccent = 'text-(color:--ds-color-on-accent)';

export default defineAppConfig({
  ui: {
    button: {
      compoundVariants: [{ color: 'primary', variant: 'solid', class: onAccent }]
    },
    badge: {
      compoundVariants: [{ color: 'primary', variant: 'solid', class: onAccent }]
    },
    tabs: {
      compoundVariants: [{ color: 'primary', variant: 'pill', class: { trigger: 'data-[state=active]:text-(color:--ds-color-on-accent)' } }]
    },
    checkbox: {
      variants: { color: { primary: { indicator: onAccent } } }
    }
  }
});
