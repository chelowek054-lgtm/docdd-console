/**
 * Переводимые подписи чистых функций. Исходник — русский, прямо в коде библиотеки; перевод
 * подставляет интерфейс (`app/plugins/labels.client.ts`), потому что `server/lib` не знает
 * ни Nuxt, ни словарей. Без переводчика — на сервере, в записи файлов и в тестах —
 * всегда русский исходник: файлы проекта не должны зависеть от языка того, кто нажал кнопку.
 */

type Params = Record<string, string | number>;
type Translate = (key: string, params?: Params) => string | null;

let translate: Translate = () => null;

export function setLabelTranslator(next: Translate): void {
  translate = next;
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Подпись по ключу; перевода нет — исходник с подставленными параметрами. */
export function label(key: string, source: string, params?: Params): string {
  return translate(key, params) ?? fill(source, params);
}

/** Словарь подписей той же формы, что исходный: значения переводятся в момент чтения. */
export function localizedLabels<K extends string>(prefix: string, source: Record<K, string>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(source) as K[]) {
    Object.defineProperty(out, key, { enumerable: true, get: () => label(`${prefix}.${key}`, source[key]) });
  }
  return out;
}
