/**
 * Контракт компонента (docs/16-design-system.md, «Контракт компонента», R-0053):
 * уровень, из чего собран, варианты, свойства, слоты, события. Состояния и слои
 * остаются в `DesignComponent` как были. Чистый разбор над объектом блока
 * `docdd-design`: ни файловой системы, ни Nuxt.
 *
 * Бизнес-логики в контракте нет. Если она неотделима от компонента — об этом
 * сказано полем `logic` с пояснением, а не умолчанием.
 */

export const COMPONENT_KINDS = ['base', 'composite'] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export interface ContractProp {
  name: string;
  /** Тип как строка: `string`, `boolean`, `'sm' | 'md'` — стеки называют его по-своему. */
  type: string;
  /** Значение по умолчанию текстом; нет ключа — умолчания нет. */
  default?: string;
  /** Допустимые значения, если их перечень закрыт. */
  values?: string[];
  required?: boolean;
}

export interface ComponentContract {
  /** Базовый или составной; не назван — уровень не заявлен. */
  kind?: ComponentKind;
  /** Из каких компонентов реестра собран составной. */
  composedOf?: string[];
  variants?: string[];
  props?: ContractProp[];
  slots?: string[];
  events?: string[];
  /** Пояснение, почему логика неотделима от компонента. */
  logic?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry !== '') : undefined;

/** Значение по умолчанию приходит и числом, и логическим: в контракте оно текст. */
const scalar = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;

/**
 * Читает контракт из записи компонента. Ошибки уходят в `bad`: блок остаётся
 * разобранным, неверная часть пропускается (как и у остальных частей блока).
 */
export function parseContract(item: Record<string, unknown>, bad: (message: string) => void): ComponentContract {
  const name = String(item['name']);
  const contract: ComponentContract = {};

  const kind = item['kind'];
  if (kind !== undefined) {
    if ((COMPONENT_KINDS as readonly unknown[]).includes(kind)) contract.kind = kind as ComponentKind;
    else bad(`у компонента \`${name}\` уровень \`${String(kind)}\` не из списка: ${COMPONENT_KINDS.join(', ')}.`);
  }
  const composedOf = strings(item['composedOf']);
  if (composedOf) contract.composedOf = composedOf;
  if (contract.kind === 'base' && composedOf && composedOf.length > 0) {
    bad(`компонент \`${name}\` базовый, но собран из других (\`composedOf\`): либо он составной, либо список лишний.`);
  }
  if (contract.kind === 'composite' && (!composedOf || composedOf.length === 0)) {
    bad(`компонент \`${name}\` составной, но не сказано, из каких собран (\`composedOf\`).`);
  }
  if (composedOf?.includes(name)) bad(`компонент \`${name}\` собран из самого себя.`);

  for (const key of ['variants', 'slots', 'events'] as const) {
    const list = strings(item[key]);
    if (list) contract[key] = list;
    else if (item[key] !== undefined) bad(`у компонента \`${name}\` \`${key}\` должен быть списком строк.`);
  }

  if (Array.isArray(item['props'])) {
    const props: ContractProp[] = [];
    for (const raw of item['props']) {
      if (!isRecord(raw) || typeof raw['name'] !== 'string' || raw['name'] === '' || typeof raw['type'] !== 'string' || raw['type'] === '') {
        bad(`у свойства компонента \`${name}\` нужны \`name\` и \`type\`.`);
        continue;
      }
      const def = scalar(raw['default']);
      const values = strings(raw['values']);
      props.push({
        name: raw['name'],
        type: raw['type'],
        ...(def !== undefined ? { default: def } : {}),
        ...(values ? { values } : {}),
        ...(raw['required'] === true ? { required: true } : {})
      });
    }
    contract.props = props;
  } else if (item['props'] !== undefined) bad(`у компонента \`${name}\` \`props\` должен быть списком.`);

  if (typeof item['logic'] === 'string' && item['logic'].trim() !== '') contract.logic = item['logic'];
  else if (item['logic'] !== undefined) bad(`у компонента \`${name}\` \`logic\` — пояснение строкой, почему логика неотделима.`);
  return contract;
}

/** Составные компоненты, ссылающиеся на неизвестное или друг на друга по кругу. */
export function compositionProblems(components: readonly { name: string; composedOf?: string[] | undefined }[]): string[] {
  const known = new Set(components.map((item) => item.name));
  const problems: string[] = [];
  for (const item of components) {
    for (const part of item.composedOf ?? []) {
      if (!known.has(part)) problems.push(`компонент \`${item.name}\` собран из \`${part}\`, которого нет в реестре.`);
    }
  }
  const edges = new Map(components.map((item) => [item.name, item.composedOf ?? []]));
  const seen = new Set<string>();
  const walk = (name: string, trail: string[]): void => {
    if (trail.includes(name)) {
      const loop = [...trail.slice(trail.indexOf(name)), name].join(' → ');
      if (!seen.has(loop)) problems.push(`составной компонент собран по кругу: ${loop}.`);
      seen.add(loop);
      return;
    }
    for (const next of edges.get(name) ?? []) walk(next, [...trail, name]);
  };
  for (const item of components) walk(item.name, []);
  return problems;
}
