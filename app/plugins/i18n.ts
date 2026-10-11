import { DEFAULT_LOCALE, LOCALES } from '~/composables/useT';

/**
 * Язык интерфейса из cookie, одинаково на сервере и на клиенте: иначе первая
 * отрисовка шла бы на основном языке и страница «мигала» бы после гидрации.
 * Атрибут `lang` страницы следует за выбором — читалкам экрана это важно.
 */
export default defineNuxtPlugin(() => {
  const cookie = useCookie<string | null>('docdd-locale');
  const locale = useState<string>('locale', () => DEFAULT_LOCALE);
  if (cookie.value && LOCALES.includes(cookie.value)) locale.value = cookie.value;

  useHead({ htmlAttrs: { lang: () => locale.value } });
});
