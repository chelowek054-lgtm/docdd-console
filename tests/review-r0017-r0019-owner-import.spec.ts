// V-0017 (manual) и V-0019 (manual) — подготовка человеку: владелец возможности (R-0017), импорт Jira/Confluence (R-0019). Отметку «Проверено» ставит человек.
import { describe, expect, it } from 'vitest';

import { effectiveOwner } from '../server/lib/functional';
import { confluenceNotes, htmlToMarkdown, jiraNotes, parseCsv, parseJira } from '../server/lib/external-import';

describe('R-0017: владелец возможности', () => {
  const caps = [
    { id: 'a', title: 'A', owner: 'ann' },
    { id: 'b', title: 'B', parent: 'a' },
    { id: 'c', title: 'C', parent: 'b', owner: ' bob ' },
    { id: 'd', title: 'D' }
  ] as never[];
  const byId = new Map((caps as { id: string }[]).map((c) => [c.id, c as never]));
  it('собственный владелец главнее, иначе ближайший родитель, иначе нет', () => {
    const own = (id: string) => effectiveOwner(byId.get(id) as never, byId as never);
    expect(own('c')).toEqual({ value: 'bob', inherited: false, from: 'c' });
    expect(own('b')).toEqual({ value: 'ann', inherited: true, from: 'a' });
    expect(own('d')).toBeNull();
  });
});

describe('R-0019: Jira', () => {
  it('CSV: кавычки, запятые и переводы строк внутри полей; ни одна задача не теряется', () => {
    const csv = 'Issue key,Summary,Description,Issue Type,Status,Parent\r\nA-1,"Со ""кавычкой"", и запятой","строка 1\nстрока 2",Epic,Open,\r\nA-2,Вторая,,Task,Done,A-1\r\n';
    expect(parseCsv(csv)[1]![2]).toBe('строка 1\nстрока 2');
    const issues = parseJira(csv);
    expect(issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    expect(issues[0]!.summary).toBe('Со "кавычкой", и запятой');
    const notes = jiraNotes(issues);
    expect(notes).toHaveLength(2);
    expect(notes[0]!.body).toContain('эпик');
    expect(notes[1]!.body).toContain('A-1');
  });
  it('JSON: массив и { issues }, родитель и связи', () => {
    const one = { key: 'B-1', fields: { summary: 'S', issuetype: { name: 'Story' }, parent: { key: 'B-0' }, issuelinks: [{ outwardIssue: { key: 'B-2' } }] } };
    for (const text of [JSON.stringify([one]), JSON.stringify({ issues: [one] })]) {
      const [issue] = parseJira(text);
      expect(issue).toMatchObject({ key: 'B-1', parent: 'B-0', links: ['B-2'], type: 'Story' });
    }
  });
});

describe('R-0019: Confluence', () => {
  it('HTML в Markdown', () => {
    const md = htmlToMarkdown('<h2>Заг</h2><p>Текст &amp; <a href="http://x">ссылка</a></p><ul><li>раз</li></ul><script>x()</script>');
    expect(md).toContain('## Заг');
    expect(md).toContain('[ссылка](http://x)');
    expect(md).toContain('- раз');
    expect(md).not.toContain('x()');
  });
  it('дерево страниц — путь «А / Б»; цикл не зависает', () => {
    const notes = confluenceNotes([
      { title: 'А', parent: '', body: 'a' }, { title: 'Б', parent: 'А', body: '<p>b</p>' }, { title: 'В', parent: 'Б', body: 'c' },
      { title: 'Ц1', parent: 'Ц2', body: '' }, { title: 'Ц2', parent: 'Ц1', body: '' }
    ]);
    expect(notes[2]!.body).toContain('А / Б / В');
    expect(notes[1]!.body).toContain('А / Б');
    expect(notes).toHaveLength(5);
  });
});
