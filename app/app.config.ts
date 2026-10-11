/**
 * Акцент в Nuxt UI (docs/16-design-system.md, «Акцент в Nuxt UI»). У библиотеки
 * одна переменная `--ui-primary` и для заливки, и для текста, а подпись на
 * сплошной заливке берётся из общей `--ui-text-inverted`, парной к нейтральной
 * кнопке. Яркий акцент на светлом фоне как текст не держит 4.5:1, белая подпись
 * на нём — тоже, поэтому текст акцентом идёт ролью `accentText`, подпись —
 * ролью `onAccent`. Настраивается темой самих компонентов — стили снаружи не
 * переопределяются (ADR-0005).
 */
const onAccent = 'text-(color:--ds-color-on-accent)';
const accentText = 'text-(color:--ds-color-accent-text)';

/** Варианты, где акцент — цвет текста, а не заливка. */
const textVariants = (variants: readonly string[], cls: string) =>
  variants.map((variant) => ({ color: 'primary' as const, variant, class: cls }));

export default defineAppConfig({
  ui: {
    button: {
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: onAccent },
        ...textVariants(['outline', 'soft', 'subtle', 'ghost'], accentText),
        { color: 'primary', variant: 'link', class: `${accentText} hover:text-(color:--ds-color-accent-text)/75 active:text-(color:--ds-color-accent-text)/75` }
      ]
    },
    badge: {
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: onAccent },
        ...textVariants(['outline', 'soft', 'subtle'], accentText)
      ]
    },
    alert: {
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: { root: onAccent } },
        ...textVariants(['outline', 'soft', 'subtle'], '').map((item) => ({ ...item, class: { root: accentText } }))
      ]
    },
    tabs: {
      compoundVariants: [
        { color: 'primary', variant: 'pill', class: { trigger: 'data-[state=active]:text-(color:--ds-color-on-accent)' } },
        { color: 'primary', variant: 'link', class: { trigger: 'data-[state=active]:text-(color:--ds-color-accent-text)' } }
      ]
    },
    checkbox: {
      variants: { color: { primary: { indicator: onAccent } } }
    }
  }
});
