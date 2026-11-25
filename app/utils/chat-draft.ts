export type ChatMode = 'ask' | 'task' | 'map';

export interface ChatDraft {
  type: 'task' | 'map';
  title: string;
  body: string;
  recordId?: string;
  rejected?: boolean;
}

export function chatDraft(mode: ChatMode, answer: string, map?: string): ChatDraft | undefined {
  const text = answer.replace(/\r\n/g, '\n');
  if (mode === 'map' && map && text.includes('```docdd-' + map + '\n')) {
    return { type: 'map', title: 'Изменение карты · ' + map, body: text };
  }
  if (mode !== 'task') return;
  const json = text.match(/^`{3}docdd-task\s*\n([\s\S]*?)\n`{3}\s*$/m)?.[1];
  if (!json) return;
  try {
    const { title, description, expected } = JSON.parse(json) as Record<string, unknown>;
    if (typeof title !== 'string' || typeof description !== 'string' || typeof expected !== 'string') return;
    if (!title.trim() || !description.trim() || !expected.trim()) return;
    return { type: 'task', title: title.trim().replace(/\s+/g, ' ').slice(0, 160), body: description.trim().slice(0, 16000) + '\n\n## Ожидаемый результат\n\n' + expected.trim().slice(0, 8000) };
  } catch {
    return;
  }
}
