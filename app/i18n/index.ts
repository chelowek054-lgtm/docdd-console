import { design as enDesign } from './en/design';
import { shell as enShell } from './en/shell';
import { design as ruDesign } from './ru/design';
import { shell as ruShell } from './ru/shell';
import { screens as enScreens } from './en/screens';
import { screens as ruScreens } from './ru/screens';

/**
 * Словари интерфейса по языкам (docs/16-design-system.md, «i18n»). Языки
 * продукта объявлены в токенах дизайна; здесь — тексты. Основной язык — русский,
 * второй — английский. Экраны, ещё не переведённые на ключи, остаются на русском
 * исходнике: перевод идёт по группам, а не одним коммитом.
 */
export const messages: Record<string, Record<string, string>> = {
  ru: { ...ruShell, ...ruDesign, ...ruScreens, ...ruPages },
  en: { ...enShell, ...enDesign, ...enScreens, ...enPages }
};
import { pages as enPages } from './en/pages';
import { pages as ruPages } from './ru/pages';
