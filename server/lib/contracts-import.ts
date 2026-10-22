import yaml from 'js-yaml';

import { parseGlossary, type GlossaryTerm } from './glossary';
import type { ProposedRecord } from './inbox';
import type { FileFinding } from './source-detect';

/**
 * Контракты, справки и глоссарий из кода и документации (R-0080, docs/04-ui.md,
 * «Подключение»). Из файлов OpenAPI, proto и JSON-схем — записи `contract` со
 * ссылкой на файл; из файла зависимостей — справки `reference`; из терминов
 * документации — строки глоссария. Чистые функции над текстом файлов; всё —
 * черновики с указанием источника, подтверждает человек.
 */

export interface ContractInfo { title: string; summary: string }

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** Название и краткое содержание контракта по формату; нечитаемое — `null`, а не выдуманное. */
export function parseContract(format: string, path: string, text: string): ContractInfo | null {
  const file = path.split('/').pop() ?? path;
  try {
    if (format === 'openapi' || format === 'asyncapi') {
      const doc = asObject(/\.json$/i.test(path) ? JSON.parse(text) : yaml.load(text));
      const info = asObject(doc['info']);
      const title = typeof info['title'] === 'string' ? info['title'] : file;
      const paths = asObject(doc[format === 'openapi' ? 'paths' : 'channels']);
      const methods = Object.values(paths).reduce<number>((sum, item) => sum + Object.keys(asObject(item)).filter((key) => /^(get|put|post|delete|patch|head|options|publish|subscribe)$/i.test(key)).length, 0);
      const version = typeof info['version'] === 'string' ? `, версия ${info['version']}` : '';
      return { title, summary: `${format === 'openapi' ? 'HTTP API' : 'Асинхронный API'}${version}: ${Object.keys(paths).length} путей, ${methods} операций` };
    }
    if (format === 'proto') {
      const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(text)?.[1];
      const services = [...text.matchAll(/^\s*service\s+(\w+)/gm)].map((match) => match[1] as string);
      const rpcs = [...text.matchAll(/^\s*rpc\s+\w+/gm)].length;
      const messages = [...text.matchAll(/^\s*message\s+\w+/gm)].length;
      return { title: pkg ?? services[0] ?? file, summary: `protobuf: сервисов ${services.length}${services.length ? ` (${services.join(', ')})` : ''}, вызовов ${rpcs}, сообщений ${messages}` };
    }
    if (format === 'json-schema') {
      const doc = asObject(JSON.parse(text));
      const title = typeof doc['title'] === 'string' ? doc['title'] : file.replace(/\.schema\.json$/i, '');
      const props = Object.keys(asObject(doc['properties'])).length;
      const note = typeof doc['description'] === 'string' ? ` — ${doc['description'].split(/[.\n]/)[0]}` : '';
      return { title, summary: `JSON-схема: полей верхнего уровня ${props}${note}` };
    }
    if (format === 'graphql') {
      const types = [...text.matchAll(/^\s*(type|input|enum|interface)\s+\w+/gm)].length;
      return { title: file, summary: `GraphQL-схема: определений ${types}` };
    }
  } catch { return null; }
  return null;
}

/** Файлы, на которые уже ссылается подтверждённая или черновая запись `contract` (путь стоит в её теле). */
export function referencedPaths(records: readonly { type: string; body: string }[]): Set<string> {
  const found = new Set<string>();
  for (const record of records) {
    if (record.type !== 'contract') continue;
    for (const match of record.body.matchAll(/`([^`\s]+\.[A-Za-z0-9]+)`/g)) found.add(match[1] as string);
  }
  return found;
}

/** Контракты-черновики по найденным файлам; читаемые и ещё не заведённые. */
export function contractRecords(files: readonly FileFinding[], read: (path: string) => string | null, already: ReadonlySet<string>): { records: ProposedRecord[]; skipped: string[] } {
  const records: ProposedRecord[] = [];
  const skipped: string[] = [];
  for (const file of files.filter((item) => item.kind === 'contract')) {
    if (already.has(file.path)) continue;
    const text = read(file.path);
    const info = text === null ? null : parseContract(file.format, file.path, text);
    if (!info) { skipped.push(file.path); continue; }
    records.push({
      key: `contract${records.length + 1}`, type: 'contract', title: `Контракт: ${info.title}`,
      body: `Источник: \`${file.path}\` (${file.format}).\n\n${info.summary}.\n\nЧерновик по файлу в коде: подтвердите, что это действующий контракт обмена, и допишите, кто его потребитель.`
    });
  }
  return { records, skipped };
}

// --- справки из файла зависимостей ---

export interface Dependency { name: string; version: string }

/** Прямые зависимости проекта по формату файла; разработческие не входят — справка нужна тому, что в коде. */
export function parseDependencies(format: string, text: string): Dependency[] {
  const found: Dependency[] = [];
  try {
    if (format === 'npm' || format === 'composer') {
      const doc = asObject(JSON.parse(text));
      for (const [name, version] of Object.entries(asObject(doc['dependencies'] ?? doc['require']))) if (format === 'composer' ? !/^(php|ext-)/.test(name) : true) found.push({ name, version: String(version) });
    } else if (format === 'pip') {
      for (const line of text.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z0-9][\w.-]*)\s*(?:[=<>~!]=?\s*([\w.*+-]+))?/.exec(line);
        if (match && !line.trim().startsWith('#') && !line.trim().startsWith('-')) found.push({ name: match[1] as string, version: match[2] ?? '' });
      }
    } else if (format === 'python') {
      const section = /^dependencies\s*=\s*\[([\s\S]*?)\]/m.exec(text)?.[1] ?? '';
      for (const item of section.matchAll(/["']\s*([A-Za-z0-9][\w.-]*)\s*([^"']*)["']/g)) found.push({ name: item[1] as string, version: (item[2] ?? '').trim() });
    } else if (format === 'go') {
      const block = /require\s*\(([\s\S]*?)\)/.exec(text)?.[1] ?? '';
      const single = [...text.matchAll(/^require\s+(\S+)\s+(\S+)/gm)].map((match) => `${match[1]} ${match[2]}`).join('\n');
      for (const line of `${block}\n${single}`.split(/\r?\n/)) {
        const match = /^\s*(\S+)\s+(v[\w.+-]+)(?!.*\/\/\s*indirect)/.exec(line);
        if (match) found.push({ name: match[1] as string, version: match[2] as string });
      }
    } else if (format === 'cargo') {
      const section = /^\[dependencies\]([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(text)?.[1] ?? '';
      for (const line of section.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]+)"|\{[^}]*version\s*=\s*"([^"]+)")/.exec(line);
        if (match) found.push({ name: match[1] as string, version: (match[2] ?? match[3] ?? '') });
      }
    }
  } catch { return []; }
  const seen = new Set<string>();
  return found.filter((item) => (seen.has(item.name.toLowerCase()) ? false : seen.add(item.name.toLowerCase())));
}

/** Не больше стольких справок за заход: сотня черновиков не читается, а человеку нужны главные. */
export const REFERENCE_LIMIT = 40;

/** Справки-черновики по зависимостям: источник — файл, дата — сегодня; уже заведённые по названию не повторяются. */
export function referenceRecords(file: FileFinding, deps: readonly Dependency[], existingTitles: ReadonlySet<string>, today: string): { records: ProposedRecord[]; left: number } {
  const fresh = deps.filter((dep) => !existingTitles.has(dep.name.toLowerCase()));
  return {
    left: Math.max(0, fresh.length - REFERENCE_LIMIT),
    records: fresh.slice(0, REFERENCE_LIMIT).map((dep, at) => ({
      key: `ref${at + 1}`, type: 'reference' as const, title: dep.name,
      summary: `зависимость проекта${dep.version ? ` ${dep.version}` : ''}; назначение не описано — дополните`,
      kind: 'component', source: `${file.path} (${file.format})`, fetched: today,
      body: `Зависимость из \`${file.path}\`. Что решает, когда брать, ограничения — допишите; пока это только факт, что проект её использует.`
    }))
  };
}

// --- глоссарий из документации ---

export interface DocTerm extends GlossaryTerm { source: string }

/** Термины из текстов документации: строки «**Термин** — определение»; повтор берётся первым. */
export function termsFromDocs(docs: readonly { path: string; text: string }[]): DocTerm[] {
  const seen = new Set<string>();
  const out: DocTerm[] = [];
  for (const doc of docs) {
    for (const term of parseGlossary(doc.text)) {
      const key = term.term.toLowerCase();
      if (seen.has(key) || term.term.length > 60 || term.definition.length < 8) continue;
      seen.add(key);
      out.push({ ...term, source: doc.path });
    }
  }
  return out;
}

const SECTION = '## Из документации (проверьте)';

/**
 * Дописывает новые термины в конец `glossary.md`, отдельным разделом с источником у каждого: существующие
 * строки и термины не трогаются, а повтор разделом не задваивается. Нет файла — создаётся с заголовком.
 */
export function mergeGlossary(existing: string | null, found: readonly DocTerm[], project: string): { text: string; added: number } {
  const known = new Set(parseGlossary(existing ?? '').map((item) => item.term.toLowerCase()));
  const fresh = found.filter((item) => !known.has(item.term.toLowerCase()));
  if (fresh.length === 0) return { text: existing ?? '', added: 0 };
  const lines = fresh.map((item) => `- **${item.term}** — ${item.definition.replace(/\.$/, '')}. (из \`${item.source}\`)`);
  const base = (existing ?? `# Глоссарий проекта «${project}»\n\nТермины, которыми говорит команда. Формат строки: \`- **Термин** — определение.\`\n`).replace(/\s+$/, '');
  const hasSection = base.includes(SECTION);
  return { text: `${base}\n\n${hasSection ? '' : `${SECTION}\n\n`}${lines.join('\n')}\n`, added: fresh.length };
}
