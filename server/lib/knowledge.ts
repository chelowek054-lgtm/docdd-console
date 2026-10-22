import { titleOf } from './inbox';

/**
 * Пространство знаний (R-0016, docs/15-team-platform.md): заметки входящего
 * как дерево страниц. Документы проекта сюда не входят — у них свои пункты
 * меню (docs/04-ui.md, «Навигация»). Чистая функция над заметками — своей базы
 * страниц нет, дерево собирается из файлов каждый раз.
 */

export interface KnowledgeNode {
  /** Путь файла (для заметки) или id записи. */
  key: string;
  title: string;
  /** Запись индекса или заметка входящего: от этого зависит, куда ведёт страница. */
  kind: 'record' | 'note';
  recordId?: string;
  status?: string;
  children: KnowledgeNode[];
}

export function knowledgeTree(notes: readonly { path: string; text: string }[] = []): KnowledgeNode[] {
  const children = notesTree(notes);
  return children.length > 0 ? [{ key: 'group:notes', title: 'База знаний (входящее)', kind: 'note', children }] : [];
}

/** Хлебные крошки страницы: группа → документ. */
export function breadcrumbs(tree: readonly KnowledgeNode[], key: string): KnowledgeNode[] {
  for (const group of tree) {
    const hit = group.children.find((child) => child.key === key) ?? deepFind(group.children, key);
    if (hit) return [group, hit];
  }
  return [];
}

const TREE_PATH = /Место в дереве страниц:\s*([^\n]+?)\.?\s*(?:\n|$)/;

/**
 * Заметки с путём «А / Б» (выгрузка Confluence, T-0048) встают деревом: страница
 * Б под страницей А. Предок, которого среди заметок нет, становится пустым
 * разделом. Заметки без пути остаются плоским списком, как раньше.
 */
export function notesTree(notes: readonly { path: string; text: string }[]): KnowledgeNode[] {
  const roots: KnowledgeNode[] = [];
  const sections = new Map<string, KnowledgeNode>();
  for (const note of notes) {
    const chain = TREE_PATH.exec(note.text)?.[1]?.split(' / ').map((part) => part.trim()).filter(Boolean) ?? [];
    const leaf: KnowledgeNode = { key: note.path, title: titleOf(note.path, note.text), kind: 'note', children: [] };
    if (chain.length < 2) { roots.push(leaf); continue; }
    let siblings = roots;
    let prefix = '';
    for (const part of chain.slice(0, -1)) {
      prefix = `${prefix}/${part}`;
      let section = sections.get(prefix);
      if (!section) {
        section = { key: `section:${prefix}`, title: part, kind: 'note', children: [] };
        sections.set(prefix, section);
        siblings.push(section);
      }
      siblings = section.children;
    }
    siblings.push(leaf);
  }
  return roots;
}

/** Страница на любой глубине: вложенные заметки не лежат прямо под группой. */
function deepFind(nodes: readonly KnowledgeNode[], key: string): KnowledgeNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    const inner = deepFind(node.children, key);
    if (inner) return inner;
  }
  return undefined;
}
