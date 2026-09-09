/**
 * `.gitignore`, читаемый ровно настолько, насколько нужно описи кода
 * (docs/07-maps.md): сборочный мусор (`__pycache__/`, `*.pyc`,
 * `.pytest_cache/`, `node_modules/` — что угодно, что сам проект уже назвал
 * не своим кодом) не должен спрашиваться у модели на каждом заходе за
 * «Обновить карты» и не должен попадать в карту сам.
 *
 * Не полный движок gitignore — только частый случай: имя файла или папки
 * (`__pycache__/`), маска с `*` (`*.pyc`), без учёта вложенных путей внутри
 * правила и без отрицаний (`!строка`) — такое правило просто пропускается,
 * не пытаясь понять, что оно исключает: смолчать безопаснее, чем исключить
 * не то. Игнорируется по каждой папке отдельно, как и настоящий git:
 * `.gitignore` глубже переопределяет то, что видно только внутри него же.
 */

/** Строки правил из содержимого одного `.gitignore` — без пустых и комментариев. */
export function parseGitignore(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (line === '' || line.startsWith('#') || line.startsWith('!')) return false;
      // `/` где-то внутри — путь, а не просто имя: за пределами того, что
      // умеет этот разбор (см. описание файла). `/` на конце — не путь, а
      // отметка «только для папки», её оставляем.
      const body = line.endsWith('/') ? line.slice(0, -1) : line;
      return !body.includes('/');
    });
}

/** `*` — любые символы, кроме них самих ничего специального не разбираем. */
function toRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Правило с `/` на конце — только для папок; иначе подходит и файлу, и
 * папке с таким именем (так же ведёт себя настоящий gitignore).
 */
export function isIgnored(rules: readonly string[], name: string, isDirectory: boolean): boolean {
  for (const rule of rules) {
    const dirOnly = rule.endsWith('/');
    if (dirOnly && !isDirectory) continue;
    const pattern = dirOnly ? rule.slice(0, -1) : rule;
    if (toRegExp(pattern).test(name)) return true;
  }
  return false;
}
