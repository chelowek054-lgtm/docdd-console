import type { DiagramBlock } from './types';

/**
 * Два способа задать диаграмму, оба обязательны к поддержке
 * (docs/02-workspace-contract.md): блок ```mermaid внутри документа и отдельный
 * файл `.mmd`, вставленный ссылкой. Отрисовка — фаза 4, здесь только разбор.
 *
 * Чтение файла `.mmd` передаётся снаружи: модуль остаётся чистой функцией над
 * строками, а границу корня проекта стережёт `paths.ts`.
 */
export function extractDiagrams(
  body: string,
  readMmd?: (path: string) => string | null
): DiagramBlock[] {
  const diagrams: DiagramBlock[] = [...inlineBlocks(body)];

  for (const link of mmdLinks(body)) {
    if (!readMmd) {
      diagrams.push({ kind: 'file', source: '', path: link.path, caption: link.caption });
      continue;
    }
    const source = readMmd(link.path);
    diagrams.push(source === null
      // Ошибка диаграммы — предупреждение у документа, а не отказ его показать.
      ? { kind: 'file', source: '', path: link.path, caption: link.caption, error: `Файл диаграммы \`${link.path}\` не прочитан` }
      : { kind: 'file', source, path: link.path, caption: link.caption });
  }

  return diagrams;
}

function* inlineBlocks(body: string): Generator<DiagramBlock> {
  const pattern = /^[ \t]*(?:```|~~~)[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)^[ \t]*(?:```|~~~)[ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const source = (match[1] ?? '').replace(/\s+$/, '');
    yield source
      ? { kind: 'inline', source }
      : { kind: 'inline', source: '', error: 'Пустой блок mermaid' };
  }
}

function* mmdLinks(body: string): Generator<{ path: string; caption: string }> {
  const pattern = /!\[([^\]]*)\]\(\s*<?([^)>\s]+\.mmd)>?\s*(?:"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const path = match[2];
    if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path)) continue;
    yield { path, caption: match[1] ?? '' };
  }
}
