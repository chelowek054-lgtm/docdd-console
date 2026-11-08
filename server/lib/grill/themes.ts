/** Темы допроса: задаёт их консоль, а вопросы под проект собирает модель (A-0003, docs/08-usage.md). */
export interface GrillTheme {
  id: string;
  title: string;
  asks: string;
}

export const GRILL_THEMES: readonly GrillTheme[] = [
  { id: 'problem', title: 'Проблема и люди', asks: 'какую проблему решает продукт, для кого, как они живут без него' },
  { id: 'outcome', title: 'Итог', asks: 'как выглядит «готово»: что пользователь хочет увидеть в конце, по чему поймёт успех' },
  { id: 'scope', title: 'Границы', asks: 'чего продукт не делает и не будет делать' },
  { id: 'scenarios', title: 'Сценарии', asks: 'главные пути пользователей, от входа до результата' },
  { id: 'data', title: 'Данные и интеграции', asks: 'что хранится, откуда приходит, с чем связано снаружи' },
  { id: 'load', title: 'Нагрузка', asks: 'сколько пользователей, запросов, данных; рост; пики' },
  { id: 'reliability', title: 'Надёжность и безопасность', asks: 'что недопустимо потерять, кто что видит, требования закона' },
  { id: 'stack', title: 'Стек и окружения', asks: 'на чём пишем, где живёт, как выкладываем' },
  { id: 'schedule', title: 'Сроки и ресурсы', asks: 'к какому сроку, кто работает, что уже есть' },
  { id: 'pitfalls', title: 'Подводные камни', asks: 'что пугает, где уже обжигались, что может пойти не так' },
  { id: 'feel', title: 'Ощущения', asks: 'каким продукт должен ощущаться: строгим, быстрым, тёплым; на что похож и на что не должен' }
];

/** Вопрос вне списка тем не теряем: модель могла заметить то, чего список не предусмотрел. */
export const OTHER_THEME = 'other';

const KNOWN = new Set(GRILL_THEMES.map((theme) => theme.id));

export const isThemeId = (id: string): boolean => KNOWN.has(id);

export const themeTitle = (id: string): string => GRILL_THEMES.find((theme) => theme.id === id)?.title ?? 'Вне тем';
