import { designTokens } from '~/design-tokens';
import { messages } from '~/i18n/index';
import { setTrLocale } from '~/i18n/tr';

/**
 * i18n интерфейса консоли (docs/16-design-system.md, «i18n»). Языки, основной
 * и запасной берутся из токенов дизайна — тех же, которые консоль выгружает в
 * проекты, поэтому её язык не расходится с правилом, которое она проверяет.
 *
 * Ключ, которого нет в словаре языка, берётся у запасного, затем у основного;
 * нет и там — показывается сам ключ, а не пустое место: пропуск виден.
 */
export const LOCALES: readonly string[] = designTokens.i18n.locales;
export const DEFAULT_LOCALE: string = designTokens.i18n.default;
export const FALLBACK_LOCALE: string = designTokens.i18n.fallback;

const COOKIE = 'docdd-locale';

/** Подстановка `{name}` из параметров; незнакомое остаётся как есть. */
function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translate(locale: string, key: string, params?: Record<string, string | number>): string {
  const text = messages[locale]?.[key] ?? messages[FALLBACK_LOCALE]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? key;
  return fill(text, params);
}

export function useT() {
  const locale = useState<string>('locale', () => DEFAULT_LOCALE);
  const cookie = useCookie<string | null>(COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });

  setTrLocale(locale.value);

  function t(key: string, params?: Record<string, string | number>): string {
    return translate(locale.value, key, params);
  }

  /** Число с существительным: форма берётся по правилам языка из ключей `<ключ>.one|few|many`, `{n}` — число. */
  function tn(key: string, n: number, params?: Record<string, string | number>): string {
    const form = new Intl.PluralRules(tag.value).select(n);
    return translate(locale.value, `${key}.${form === 'other' || form === 'zero' || form === 'two' ? 'many' : form}`, { ...params, n });
  }

  function setLocale(next: string) {
    if (!LOCALES.includes(next)) return;
    locale.value = next;
    setTrLocale(next);
    cookie.value = next;
  }

  /** Тег языка для `Intl`: даты и числа пишутся по правилам выбранного языка. */
  const tag = computed(() => (locale.value === 'ru' ? 'ru-RU' : locale.value === 'en' ? 'en-US' : locale.value));

  function dateTime(iso: string): string {
    return new Date(iso).toLocaleString(tag.value, { dateStyle: 'short', timeStyle: 'short' });
  }

  return { t, tn, locale, setLocale, locales: LOCALES, tag, dateTime };
}
