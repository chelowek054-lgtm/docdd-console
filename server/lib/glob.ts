/**
 * Пути правил архитектуры (docs/12-practice-rules.md): `*` — один сегмент,
 * `**` — любая глубина, остальное буквально. Чистые функции.
 */

function escapeRegex(text: string): string {
  return text.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
}

const cache = new Map<string, RegExp>();

/** Шаблон целиком в регулярное выражение; хвост `/**` необязателен: `a/**` совпадает и с `a`. */
function compile(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;

  const source = pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  let out = '';
  for (let at = 0; at < source.length; at += 1) {
    const char = source[at] as string;
    if (char === '*' && source[at + 1] === '*') {
      const slash = source[at + 2] === '/';
      const leading = at === 0 || source[at - 1] === '/';
      if (slash && leading) {
        out += '(?:.*/)?'; // `**/` — ноль или больше каталогов
        at += 2;
      } else {
        out += '.*';
        at += 1;
      }
    } else if (char === '*') {
      out += '[^/]*';
    } else {
      out += escapeRegex(char);
    }
  }
  const regex = new RegExp(`^${out.replace(/\/\.\*$/, '(?:/.*)?')}$`);
  cache.set(pattern, regex);
  return regex;
}

/** Путь целиком подходит под шаблон. */
export function globMatch(pattern: string, path: string): boolean {
  return compile(pattern).test(path);
}

/**
 * Путь или любой его каталог-предок подходит под шаблон: правило про каталог
 * действует на всё, что внутри (`learningBack/modules/*` — и на файлы модуля).
 */
export function globCovers(pattern: string, path: string): boolean {
  const regex = compile(pattern);
  for (let at = path; at !== ''; at = at.includes('/') ? at.slice(0, at.lastIndexOf('/')) : '') {
    if (regex.test(at)) return true;
  }
  return false;
}
