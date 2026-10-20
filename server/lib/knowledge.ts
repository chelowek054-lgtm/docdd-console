import { titleOf } from './inbox';
import type { IndexRecord } from './types';

/**
 * Пространство знаний (R-0016, docs/15-team-platform.md): документы проекта
 * как дерево страниц. Чистая функция над индексом и заметками входящего —
 * своей базы страниц нет, дерево собирается из файлов каждый раз.
 */
const KNOWLEDGE_TYPES = ['design', 'decision', 'contract'] as const;

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

const GROUP_TITLES: Record<string, string> = { design: 'Проектные документы', decision: 'Решения', contract: 'Контракты', notes: 'База знаний (входящее)' };

export function knowledgeTree(records: readonly IndexRecord[], notes: readonly { path: string; text: string }[] = []): KnowledgeNode[] {
  const groups: KnowledgeNode[] = KNOWLEDGE_TYPES.map((type) => ({
    key: `group:${type}`,
    title: GROUP_TITLES[type] ?? type,
    kind: 'record' as const,
    children: records
      .filter((record) => record.type === type)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((record) => ({ key: record.id, title: `${record.id} · ${record.title}`, kind: 'record' as const, recordId: record.id, status: record.status, children: [] }))
  }));
  groups.push({
    key: 'group:notes',
    title: GROUP_TITLES['notes'] ?? 'notes',
    kind: 'note',
    children: notes.map((note) => ({ key: note.path, title: titleOf(note.path, note.text), kind: 'note' as const, children: [] }))
  });
  return groups.filter((group) => group.children.length > 0);
}

/** Хлебные крошки страницы: группа → документ. */
export function breadcrumbs(tree: readonly KnowledgeNode[], key: string): KnowledgeNode[] {
  for (const group of tree) {
    const hit = group.children.find((child) => child.key === key);
    if (hit) return [group, hit];
  }
  return [];
}
