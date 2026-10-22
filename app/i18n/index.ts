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
  ru: { ...ruShell, ...ruDesign, ...ruScreens, ...ruPages, ...ruRest, ...ruRecords, ...ruPages2, ...ruComponents, ...ruNav, ...ruOverview, ...ruSearch, ...ruSettings, ...ruNotifications, ...ruManager, ...ruVerify, ...ruStrategy, ...ruAgents },
  en: { ...enShell, ...enDesign, ...enScreens, ...enPages, ...enRest, ...enRecords, ...enPages2, ...enComponents, ...enNav, ...enOverview, ...enSearch, ...enSettings, ...enNotifications, ...enManager, ...enVerify, ...enStrategy, ...enAgents }
};
import { pages as enPages } from './en/pages';
import { pages as ruPages } from './ru/pages';
import { rest as enRest } from './en/rest';
import { rest as ruRest } from './ru/rest';
import { records as enRecords } from './en/records';
import { records as ruRecords } from './ru/records';
import { pages2 as enPages2 } from './en/pages2';
import { pages2 as ruPages2 } from './ru/pages2';
import { components as enComponents } from './en/components';
import { components as ruComponents } from './ru/components';
import { nav as enNav } from './en/nav';
import { nav as ruNav } from './ru/nav';
import { overview as enOverview } from './en/overview';
import { overview as ruOverview } from './ru/overview';
import { search as enSearch } from './en/search';
import { search as ruSearch } from './ru/search';
import { settings as enSettings } from './en/settings';
import { settings as ruSettings } from './ru/settings';
import { notifications as enNotifications } from './en/notifications';
import { notifications as ruNotifications } from './ru/notifications';
import { manager as enManager } from './en/manager';
import { manager as ruManager } from './ru/manager';
import { verify as enVerify } from './en/verify';
import { verify as ruVerify } from './ru/verify';
import { strategy as enStrategy } from './en/strategy';
import { strategy as ruStrategy } from './ru/strategy';
import { agents as enAgents } from './en/agents';
import { agents as ruAgents } from './ru/agents';
