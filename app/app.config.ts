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

/**
 * Вид поверх токенов D-0002 (docs/16-design-system.md, «Поверхности и вид»): мягкая заливка
 * плашек — доля роли поверх surface; цвет Nuxt UI → роль токенов.
 */
const softFill = (role: string) => `ring-0 bg-[color-mix(in_srgb,var(--ds-color-${role})_var(--ds-tint-soft),var(--ds-color-surface))]`;
const SOFT_ROLES = { primary: 'accent', success: 'ok', info: 'info', warning: 'warn', error: 'danger' } as const;
const softBadges = Object.entries(SOFT_ROLES).flatMap(([color, role]) =>
  ['soft', 'subtle'].map((variant) => ({ color: color as keyof typeof SOFT_ROLES, variant, class: softFill(role) })));

/** Зона нажатия не меньше 2.75rem: видимая форма остаётся своей, клик ловит невидимое расширение. */
const TAP = 'relative before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[\'\']';

export default defineAppConfig({
  ui: {
    card: {
      slots: { root: 'rounded-(--ds-radius-lg) ds-appear' },
      variants: { variant: { outline: { root: 'ring-0 shadow-(--ds-shadow-card)' } } }
    },
    input: { slots: { base: 'min-h-11' } },
    select: { slots: { base: 'min-h-11' } },
    button: {
      slots: { base: TAP },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: onAccent },
        ...textVariants(['outline', 'soft', 'subtle', 'ghost'], accentText),
        { color: 'primary', variant: 'link', class: `${accentText} hover:text-(color:--ds-color-accent-text)/75 active:text-(color:--ds-color-accent-text)/75` }
      ]
    },
    badge: {
      compoundVariants: [
        ...softBadges,
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
