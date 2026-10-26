import { inflateRawSync } from 'node:zlib';

/**
 * HTML-макеты экранов из Claude Design (R-0106, docs/16-design-system.md). Чистые
 * функции над байтами и строками: раскладка загруженного файла, цвета макета,
 * подмена темы при отдаче. Файловая система — у сервиса.
 */

/** Больше — не экран, а что-то другое: отказ, а не тихая обрезка. */
export const MOCKUP_LIMIT = 10 * 1024 * 1024;

export interface MockupFile {
  /** Путь внутри каталога экрана, с `/`. */
  path: string;
  data: Buffer;
}

export interface MockupUnpack {
  files: MockupFile[];
  problems: string[];
}

/** Путь из архива: относительный, без `..`, без буквы диска — иначе отказ целиком. */
export function safeEntryPath(path: string): string | null {
  const clean = path.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (clean === '' || clean.startsWith('/') || /^[A-Za-z]:/.test(clean)) return null;
  if (clean.split('/').some((part) => part === '..' || part === '')) return null;
  return clean;
}

/**
 * Записи zip: центральный каталог, методы «без сжатия» и deflate. Своя короткая
 * читалка, а не зависимость: экспорт Claude Design — обычный zip, больше не нужно.
 */
export function unzipEntries(buffer: Buffer): { path: string; data: Buffer }[] {
  let end = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 65_557); at -= 1) {
    if (buffer.readUInt32LE(at) === 0x06054b50) { end = at; break; }
  }
  if (end < 0) throw new Error('Это не zip: нет оглавления архива.');
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const entries: { path: string; data: Buffer }[] = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('Оглавление zip повреждено.');
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const path = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    at += 46 + nameLength + extraLength + commentLength;
    if (path.endsWith('/')) continue;
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Файл архива ${path} сжат неизвестным способом (${method}).`);
    entries.push({ path, data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw) });
  }
  return entries;
}

/**
 * Загруженный файл → файлы каталога экрана. HTML ложится как `index.html`. В архиве
 * главный — `index.html`, а нет его — единственный `.html`; общий верхний каталог
 * экспорта срезается, чтобы ссылки макета на свои файлы остались рабочими.
 */
export function unpackMockup(name: string, buffer: Buffer): MockupUnpack {
  if (buffer.length > MOCKUP_LIMIT) return { files: [], problems: [`Файл больше ${MOCKUP_LIMIT / 1024 / 1024} МБ: это не экран.`] };
  const lower = name.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return { files: [{ path: 'index.html', data: buffer }], problems: [] };
  if (!lower.endsWith('.zip')) return { files: [], problems: ['Нужен .html или .zip — экспорт Claude Design.'] };

  let entries: { path: string; data: Buffer }[];
  try {
    entries = unzipEntries(buffer).filter((entry) => !entry.path.startsWith('__MACOSX/'));
  } catch (error) {
    return { files: [], problems: [String((error as Error).message)] };
  }
  const bad = entries.filter((entry) => safeEntryPath(entry.path) === null).map((entry) => entry.path);
  if (bad.length) return { files: [], problems: [`В архиве пути за пределами экрана: ${bad.slice(0, 5).join(', ')}.`] };
  const total = entries.reduce((sum, entry) => sum + entry.data.length, 0);
  if (total > MOCKUP_LIMIT) return { files: [], problems: [`Распакованный архив больше ${MOCKUP_LIMIT / 1024 / 1024} МБ.`] };

  const paths = entries.map((entry) => safeEntryPath(entry.path) as string);
  const top = paths[0]?.split('/')[0];
  const shared = top && paths.every((path) => path.startsWith(top + '/')) ? top.length + 1 : 0;
  const files = entries.map((entry, at) => ({ path: (paths[at] as string).slice(shared), data: entry.data }));
  const htmls = files.filter((file) => /\.html?$/i.test(file.path));
  const main = files.find((file) => file.path === 'index.html') ?? (htmls.length === 1 ? htmls[0] : undefined);
  if (!main) return { files: [], problems: [htmls.length ? 'В архиве несколько .html и нет index.html: непонятно, какой из них экран.' : 'В архиве нет .html.'] };
  if (main.path !== 'index.html') {
    if (main.path.includes('/')) return { files: [], problems: [`Экран ${main.path} лежит во вложенном каталоге: положите index.html в корень архива.`] };
    main.path = 'index.html';
  }
  return { files, problems: [] };
}

/* ---------- цвета ---------- */

const hex2 = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

/** Цвет CSS → `#rrggbb` в нижнем регистре; прозрачность не в счёт; не понятый — `null`. */
export function normalizeColor(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  let match = /^#([0-9a-f]{3,8})$/.exec(text);
  if (match) {
    const value = match[1] as string;
    if (value.length === 3 || value.length === 4) return '#' + value.slice(0, 3).split('').map((c) => c + c).join('');
    if (value.length === 6 || value.length === 8) return '#' + value.slice(0, 6);
    return null;
  }
  match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
  if (match) return '#' + [match[1], match[2], match[3]].map((part) => hex2(Number(part))).join('');
  match = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(text);
  if (match) {
    const h = Number(match[1]) / 360;
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return '#' + [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((value) => hex2(value * 255)).join('');
  }
  return null;
}

const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

/** Цвета макета: из стилей и атрибутов, без повторов, по порядку появления. */
export function mockupColors(html: string): string[] {
  const seen = new Set<string>();
  // Скрипты и комментарии — не вид экрана: `#` там бывает чем угодно.
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const match of visible.matchAll(COLOR)) {
    const color = normalizeColor(match[0]);
    if (color) seen.add(color);
  }
  return [...seen];
}

/** Нейтральные края шкалы всегда допустимы: чисто белое и чисто чёрное — не выдумка макета. */
const ALWAYS = new Set(['#ffffff', '#000000']);

/** Цвета макета, которых нет среди токенов (во всех темах). */
export function offTokenColors(colors: readonly string[], tokens: readonly string[]): string[] {
  const known = new Set(tokens.map((token) => normalizeColor(token)).filter((value): value is string => !!value));
  return colors.filter((color) => !known.has(color) && !ALWAYS.has(color));
}

/* ---------- отдача ---------- */

/**
 * Тема для макета: окно изолировано, снаружи в него не залезть, поэтому тема
 * приходит в самом HTML — атрибутом, классом и схемой цвета на корне.
 */
export function withTheme(html: string, theme: string, dark: boolean): string {
  const safe = theme.replace(/[^\w-]/g, '');
  if (!safe) return html;
  const scheme = dark ? 'dark' : 'light';
  const own = ` data-theme="${safe}" style="color-scheme: ${scheme}"`;
  if (!/<html\b[^>]*>/i.test(html)) return `<html${own}${dark ? ' class="dark"' : ''}>${html}</html>`;
  return html.replace(/<html\b([^>]*)>/i, (_whole, rest: string) => {
    let attrs = rest.replace(/\s(?:data-theme|style)="[^"]*"/gi, '') + own;
    if (dark) attrs = /\sclass="/i.test(attrs) ? attrs.replace(/\sclass="([^"]*)"/i, ' class="$1 dark"') : attrs + ' class="dark"';
    return `<html${attrs}>`;
  });
}

/**
 * Размер макета для холста. Окно изолировано, заглянуть в него снаружи нельзя,
 * поэтому макет сам сообщает родителю ширину и высоту содержимого: экспорт
 * Claude Design бывает целой доской экранов, и кадр телефона её обрезал бы. Экспорт
 * после загрузки подменяет корень страницы, поэтому размер опрашивается таймером
 * на window, а не наблюдателем за элементом, которого скоро не станет.
 */
export function withSizeProbe(html: string, screen: string): string {
  const id = JSON.stringify(screen).replace(/</g, '\\u003c');
  const probe = `<script>(function(){function s(){var d=document.documentElement,b=document.body;parent.postMessage({docddMockup:${id},w:Math.max(d.scrollWidth,b?b.scrollWidth:0),h:Math.max(d.scrollHeight,b?b.scrollHeight:0)},'*')}addEventListener('load',s);addEventListener('resize',s);var n=0,i=setInterval(function(){s();if(++n>15)clearInterval(i)},1000);setTimeout(s,300);})();</script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${probe}</body>`) : html + probe;
}

const TYPES: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf'
};

export function contentTypeOf(path: string): string {
  return TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/** Поля документа-макета (`design` с `screen`); не макет — `null`. */
export function mockupOf(record: { type: string; data: Readonly<Record<string, unknown>> }): { screen: string; mockup: string | null } | null {
  if (record.type !== 'design' || typeof record.data['screen'] !== 'string' || !record.data['screen']) return null;
  return { screen: record.data['screen'], mockup: typeof record.data['mockup'] === 'string' ? record.data['mockup'] : null };
}
