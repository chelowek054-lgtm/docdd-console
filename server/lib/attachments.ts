/**
 * Вложения к прогону и дефекту (R-0099, docs/02-workspace-contract.md): скриншоты
 * и логи лежат файлами в репозитории проекта рядом с отчётами — своей базы у
 * консоли нет. Чистые функции: проверка файла и разбор пути, без файловой системы.
 */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const LOG_EXT = new Set(['txt', 'log', 'json']);

export const ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8', json: 'application/json; charset=utf-8'
};

export type AttachmentKind = 'image' | 'log';

export type AttachmentCheck =
  | { ok: true; ext: string; kind: AttachmentKind; name: string }
  | { ok: false; code: 'name_required' | 'type_not_allowed' | 'too_large' | 'empty'; message: string };

/** Безопасное имя файла: без путей и странных символов, кириллица и точка допустимы. */
export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[.-]+/, '').slice(0, 80);
  return cleaned;
}

export function extOf(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  return match ? (match[1] as string).toLowerCase() : '';
}

/** Годен ли файл: картинка или текст/лог/json, не пустой и не больше предела. */
export function checkAttachment(name: string, size: number): AttachmentCheck {
  const safe = safeName(name);
  if (!safe) return { ok: false, code: 'name_required', message: 'У файла нет имени' };
  const ext = extOf(safe);
  const kind: AttachmentKind | null = IMAGE_EXT.has(ext) ? 'image' : LOG_EXT.has(ext) ? 'log' : null;
  if (!kind) return { ok: false, code: 'type_not_allowed', message: `Файл «${safe}»: допустимы картинки (png, jpg, gif, webp) и txt, log, json` };
  if (size <= 0) return { ok: false, code: 'empty', message: `Файл «${safe}» пустой` };
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, code: 'too_large', message: `Файл «${safe}» больше ${MAX_ATTACHMENT_BYTES / 1024 / 1024} МБ` };
  return { ok: true, ext, kind, name: safe };
}

/** Папка вложений: рядом с отчётами, по дате загрузки. Путь — от корня проекта, через прямой слеш. */
export function attachmentFolder(testsFolder: string, date: string): string {
  return `docs/development/${testsFolder.replace(/^[/\\]+|[/\\]+$/g, '')}/attachments/${date}`;
}

/** Путь годится как вложение: лежит в `attachments/` и без выхода наверх. */
export function isAttachmentPath(path: string): boolean {
  if (path.includes('..') || path.includes('\\') || path.startsWith('/')) return false;
  return /\/attachments\/[^/]+\/[^/]+$/.test(path) && extOf(path) in ATTACHMENT_TYPES;
}

export function attachmentKind(path: string): AttachmentKind {
  return IMAGE_EXT.has(extOf(path)) ? 'image' : 'log';
}
