/**
 * Импорт из внешних систем (T-0047, T-0048): выгрузка Jira (CSV/JSON) и
 * страницы Confluence (HTML/Markdown) превращаются в заметки входящего.
 * Записи из заметок заводит обычный разбор входящего с подтверждением
 * человека — здесь только чистый разбор текста, файлов он не касается.
 */

export interface ExternalNote { title: string; body: string }

export interface JiraIssue {
  key: string; summary: string; description: string; type: string; status: string;
  parent: string; links: string[];
}

/** CSV с кавычками и переносами внутри полей: выгрузка Jira ими пользуется. */
export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = source.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const nameOf = (value: unknown): string => (value && typeof value === 'object' ? str((value as { name?: unknown }).name) : str(value));

function fromJson(source: string): JiraIssue[] {
  const data = JSON.parse(source) as unknown;
  const list = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray((data as { issues?: unknown }).issues) ? (data as { issues: unknown[] }).issues : []);
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const issue = entry as { key?: unknown; fields?: Record<string, unknown> };
    const fields = issue.fields ?? (entry as Record<string, unknown>);
    const parent = fields['parent'] && typeof fields['parent'] === 'object' ? str((fields['parent'] as { key?: unknown }).key) : str(fields['parent'] ?? fields['epic']);
    const links = Array.isArray(fields['issuelinks'])
      ? (fields['issuelinks'] as { outwardIssue?: { key?: unknown }; inwardIssue?: { key?: unknown } }[])
        .map((link) => str(link.outwardIssue?.key ?? link.inwardIssue?.key)).filter(Boolean)
      : [];
    return [{
      key: str(issue.key ?? fields['key']), summary: str(fields['summary']), description: str(fields['description']),
      type: nameOf(fields['issuetype'] ?? fields['type']), status: nameOf(fields['status']), parent, links
    }];
  });
}

function fromCsv(source: string): JiraIssue[] {
  const [header, ...rows] = parseCsv(source);
  if (!header) return [];
  const names = header.map((name) => name.trim().toLowerCase());
  const at = (...candidates: string[]) => names.findIndex((name) => candidates.includes(name));
  const col = { key: at('issue key', 'key'), summary: at('summary'), description: at('description'), type: at('issue type', 'type'), status: at('status'), parent: at('parent', 'parent id', 'epic link', 'custom field (epic link)') };
  const linkCols = names.flatMap((name, i) => (name.startsWith('outward issue link') ? [i] : []));
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
  return rows.map((row) => ({
    key: cell(row, col.key), summary: cell(row, col.summary), description: cell(row, col.description),
    type: cell(row, col.type), status: cell(row, col.status), parent: cell(row, col.parent),
    links: linkCols.map((i) => cell(row, i)).filter(Boolean)
  }));
}

/** Формат определяется по началу текста: расширение файла при вставке из буфера неизвестно. */
export function parseJira(source: string): JiraIssue[] {
  const head = source.trimStart()[0];
  return (head === '{' || head === '[' ? fromJson(source) : fromCsv(source)).filter((issue) => issue.key !== '' || issue.summary !== '');
}

/**
 * Одна задача Jira — одна заметка: потерять задачу при переносе нельзя, а
 * «один файл — одна тема» (docs/10-inbox.md) соблюдается сам. Эпик и связи
 * записаны текстом — разбор входящего превратит их в фазы и связи.
 */
export function jiraNotes(issues: readonly JiraIssue[]): ExternalNote[] {
  return issues.map((issue) => {
    const epic = /epic/i.test(issue.type);
    const lines = [`Выгрузка Jira: ${issue.key}${epic ? ' (эпик, кандидат в фазу)' : ''}.`, ''];
    if (issue.type) lines.push(`Тип: ${issue.type}.`);
    if (issue.status) lines.push(`Статус в Jira: ${issue.status}.`);
    if (issue.parent) lines.push(`Входит в эпик или родителя: ${issue.parent}.`);
    if (issue.links.length > 0) lines.push(`Связана с: ${issue.links.join(', ')}.`);
    if (issue.description) lines.push('', issue.description);
    return { title: `${issue.key} ${issue.summary}`.trim(), body: lines.join('\n') };
  });
}

export interface ConfluencePage { title: string; parent: string; body: string }

/** Грубое HTML в Markdown: заголовки, абзацы, списки, ссылки; остальное — голый текст. */
export function htmlToMarkdown(html: string): string {
  const decode = (value: string) => value.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => `\n\n${'#'.repeat(Number(level))} ${inner}\n\n`)
      .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<(br|\/p|\/div|\/tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Дерево страниц сохраняется путём в первой строке заметки («Раздел / Страница»):
 * из пути разбор входящего и пространство знаний восстановят вложенность.
 */
export function confluenceNotes(pages: readonly ConfluencePage[]): ExternalNote[] {
  const parents = new Map(pages.map((page) => [page.title, page.parent]));
  const pathOf = (title: string): string[] => {
    const path = [title];
    const seen = new Set(path);
    for (let at = parents.get(title); at && !seen.has(at); at = parents.get(at)) { path.unshift(at); seen.add(at); }
    return path;
  };
  return pages.map((page) => ({
    title: page.title,
    body: [`Выгрузка Confluence. Место в дереве страниц: ${pathOf(page.title).join(' / ')}.`, '', /<\/?[a-z][\s\S]*>/i.test(page.body) ? htmlToMarkdown(page.body) : page.body.trim()].join('\n')
  }));
}
