import { messages } from './index';

/**
 * Перевод для чистых функций (`app/utils`, сторы), у которых нет `useT()`.
 * Язык запоминает сам `useT()` при каждом вызове и при смене языка; вне Nuxt —
 * в юнит-тестах — остаётся русский исходник. Хранилище одно на процесс: на
 * сервере при одновременных запросах с разным языком подпись из такой функции
 * может взять чужой, поэтому сюда идут только короткие подписи, а не тексты экрана.
 */
type Params = Record<string, string | number>;

let current = 'ru';

export function setTrLocale(locale: string): void {
  current = locale;
}

function currentLocale(): string {
  return current;
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function tr(key: string, params?: Params): string {
  const locale = currentLocale();
  return fill(messages[locale]?.[key] ?? messages['ru']?.[key] ?? key, params);
}

/** Число с существительным: формы по правилам языка из ключей `<ключ>.one|few|many`, `{n}` — число. */
export function trn(key: string, n: number, params?: Params): string {
  const form = new Intl.PluralRules(currentLocale()).select(n);
  return tr(`${key}.${form === 'one' || form === 'few' ? form : 'many'}`, { ...params, n });
}
