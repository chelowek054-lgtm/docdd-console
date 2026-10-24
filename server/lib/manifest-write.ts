/**
 * Точечная правка манифеста (docs/02-workspace-contract.md). Манифест —
 * файл человека: в нём бывают комментарии и порядок, важный тому, кто его
 * писал. Полная пересборка из объекта (`js-yaml.dump`) потеряла бы и то, и
 * другое — правим построчно, тем же приёмом, что и front matter записей
 * (server/lib/write.ts), а не разбором YAML в объект и обратно.
 *
 * Понимает ровно ту форму `sources.shared`, которую сам же и пишет
 * (docs/11-shared-sources.md): список `- path: …` с необязательной
 * `tags: […]` следующей строкой, в одну строку. Форму, написанную человеком
 * иначе, — например, тегами блочным списком или `{path: …, tags: […]}` в
 * одну строку, — не трогает и честно отказывает, а не портит: угадывать
 * чужое форматирование дороже, чем попросить поправить вручную один раз.
 */

export interface ManifestEdit {
  ok: true;
  text: string;
}

export interface ManifestEditFailed {
  ok: false;
  message: string;
}

const NEW_LINE = String.fromCharCode(10);

/** Значение `path:` могло быть в кавычках — снимаем их перед сравнением. */
function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed[0] === "'" && trimmed[trimmed.length - 1] === "'") {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** `tags: [a, b, c]` → `['a', 'b', 'c']`. Пустой список внутри — пустой массив. */
function parseFlowTags(inside: string): string[] {
  const trimmed = inside.trim();
  if (trimmed === '') return [];
  return trimmed.split(',').map((item) => unquote(item)).filter((item) => item !== '');
}

/**
 * Вносит запись `builtin` с тегом `general` в `sources.shared`, если её там ещё нет:
 * первая же галочка на экране «Практики» делает неявное подключение явным. Правит
 * файл точечно и не трогает остальное, включая комментарии человека.
 */
export function ensureBuiltinEntry(manifestText: string): string {
  const eol = manifestText.includes('\r\n') ? '\r\n' : NEW_LINE;
  const lines = manifestText.split(/\r?\n/);
  if (lines.some((line) => { const match = PATH_LINE.exec(line); return match !== null && unquote(match[1] ?? '') === 'builtin'; })) return manifestText;

  const entry = (indent: string) => [`${indent}- path: builtin`, `${indent}  tags: [general]`];
  const shared = lines.findIndex((line) => /^\s{2}shared:\s*(\[\s*\])?\s*$/.test(line));
  if (shared >= 0) {
    const empty = /\[\s*\]/.test(lines[shared] ?? '');
    const next = empty ? [lines[shared]?.replace(/\s*\[\s*\]\s*$/, '') ?? '  shared:', ...entry('    ')] : [lines[shared] ?? '  shared:', ...entry('    ')];
    return [...lines.slice(0, shared), ...next, ...lines.slice(shared + 1)].join(eol);
  }
  const sources = lines.findIndex((line) => /^sources:\s*$/.test(line));
  if (sources >= 0) {
    return [...lines.slice(0, sources + 1), '  shared:', ...entry('    '), ...lines.slice(sources + 1)].join(eol);
  }
  const trimmed = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
  return [...trimmed, 'sources:', '  shared:', ...entry('    '), ''].join(eol);
}

const PATH_LINE = /^\s*-\s*path:\s*(.+?)\s*$/;
const FLOW_TAGS_LINE = /^(\s*)tags:\s*\[(.*)\]\s*$/;

/**
 * Включить или выключить один тег у источника практик с этим путём.
 * `enabled: true` — добавить тег, если его ещё нет; `false` — убрать, если
 * есть. Источника с таким путём нет, или запись `sources.shared` устроена
 * не так, как её пишет это приложение, — понятный отказ, файл не трогается.
 */
export function toggleSharedTag(
  manifestText: string,
  sourcePath: string,
  tag: string,
  enabled: boolean
): ManifestEdit | ManifestEditFailed {
  const eol = manifestText.includes('\r\n') ? '\r\n' : NEW_LINE;
  const lines = manifestText.split(/\r?\n/);

  const pathLineIndex = lines.findIndex((line) => {
    const match = PATH_LINE.exec(line);
    return match !== null && unquote(match[1] ?? '') === sourcePath;
  });
  if (pathLineIndex === -1) {
    return { ok: false, message: `Источник с путём \`${sourcePath}\` не найден в sources.shared манифеста.` };
  }

  const tagsLineIndex = pathLineIndex + 1;
  const tagsLine = lines[tagsLineIndex] ?? '';
  const tagsMatch = FLOW_TAGS_LINE.exec(tagsLine);

  // Строка похожа на tags, но не в один список через запятую — не гадаем.
  if (tagsMatch === null && tagsLine.trim().startsWith('tags:')) {
    return {
      ok: false,
      message: `Строка \`tags\` источника \`${sourcePath}\` записана не как [a, b, c] — правьте вручную в манифесте.`
    };
  }

  const current = tagsMatch ? parseFlowTags(tagsMatch[2] ?? '') : [];
  const already = current.includes(tag);
  if (enabled === already) {
    // Уже в нужном состоянии — не трогаем файл ради тождественной правки.
    return { ok: true, text: manifestText };
  }

  const next = enabled ? [...current, tag] : current.filter((item) => item !== tag);
  const indent = tagsMatch ? (tagsMatch[1] ?? '') : `${/^(\s*)-/.exec(lines[pathLineIndex] ?? '')?.[1] ?? ''}  `;
  const nextLine = `${indent}tags: [${next.join(', ')}]`;

  const nextLines = tagsMatch
    ? [...lines.slice(0, tagsLineIndex), nextLine, ...lines.slice(tagsLineIndex + 1)]
    : [...lines.slice(0, tagsLineIndex), nextLine, ...lines.slice(tagsLineIndex)];

  return { ok: true, text: nextLines.join(eol) };
}

/**
 * Дописывает определение пользовательской карты в `maps.custom`
 * (docs/adr/0028-custom-maps.md) тем же точечным приёмом: остальной файл,
 * комментарии и порядок, не трогается. Определение пишется одной строкой
 * JSON — это валидный YAML, и не нужно угадывать отступы чужих значений.
 * Понимает `maps:` блоком с `custom:` блочным списком (или `custom: []`),
 * либо их отсутствие; иную форму не правит, а отказывает.
 */
export function appendCustomMap(manifestText: string, definition: Record<string, unknown>): ManifestEdit | ManifestEditFailed {
  const eol = manifestText.includes('\r\n') ? '\r\n' : NEW_LINE;
  const lines = manifestText.split(/\r?\n/);
  const entry = `    - ${JSON.stringify(definition)}`;
  const topLevel = (line: string) => /^\S/.test(line) && !line.startsWith('#');

  const maps = lines.findIndex((line) => /^maps:/.test(line));
  if (maps < 0) {
    const trimmed = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
    return { ok: true, text: [...trimmed, 'maps:', '  custom:', entry, ''].join(eol) };
  }
  if (!/^maps:\s*(#.*)?$/.test(lines[maps] ?? '')) {
    return { ok: false, message: 'Секция `maps` записана не блоком — допишите карту вручную.' };
  }

  let end = maps + 1;
  while (end < lines.length && !topLevel(lines[end] ?? '')) end += 1;
  // Пустые строки в конце секции оставляем после вставки — за ними следующая секция.
  let last = end;
  while (last > maps + 1 && (lines[last - 1] ?? '').trim() === '') last -= 1;

  const custom = lines.findIndex((line, at) => at > maps && at < end && /^\s{2}custom:/.test(line));
  if (custom < 0) {
    return { ok: true, text: [...lines.slice(0, last), '  custom:', entry, ...lines.slice(last)].join(eol) };
  }
  const head = lines[custom] ?? '';
  if (/^\s{2}custom:\s*\[\s*\]\s*(#.*)?$/.test(head)) {
    return { ok: true, text: [...lines.slice(0, custom), '  custom:', entry, ...lines.slice(custom + 1)].join(eol) };
  }
  if (!/^\s{2}custom:\s*(#.*)?$/.test(head)) {
    return { ok: false, message: 'Список `maps.custom` записан не блоком — допишите карту вручную.' };
  }
  let tail = custom + 1;
  while (tail < last && (/^\s{3,}\S/.test(lines[tail] ?? '') || (lines[tail] ?? '').trim() === '')) tail += 1;
  while (tail > custom + 1 && (lines[tail - 1] ?? '').trim() === '') tail -= 1;
  return { ok: true, text: [...lines.slice(0, tail), entry, ...lines.slice(tail)].join(eol) };
}


/**
 * Убирает `index`-ю строку списка `maps.custom` (ADR-0036). Элемент — строка `    - …` и её
 * продолжение с отступом больше четырёх; остальной файл и комментарии не трогаются.
 */
export function removeCustomMap(manifestText: string, index: number): ManifestEdit | ManifestEditFailed {
  const eol = manifestText.includes('\r\n') ? '\r\n' : NEW_LINE;
  const lines = manifestText.split(/\r?\n/);
  const topLevel = (line: string) => /^\S/.test(line) && !line.startsWith('#');
  const maps = lines.findIndex((line) => /^maps:\s*(#.*)?$/.test(line));
  if (maps < 0) return { ok: false, message: 'Секции `maps` нет.' };
  let end = maps + 1;
  while (end < lines.length && !topLevel(lines[end] ?? '')) end += 1;
  const custom = lines.findIndex((line, at) => at > maps && at < end && /^\s{2}custom:\s*(#.*)?$/.test(line));
  if (custom < 0) return { ok: false, message: 'Список `maps.custom` записан не блоком — уберите карту вручную.' };
  const starts: number[] = [];
  let stop = custom + 1;
  while (stop < end && (/^\s{3,}\S/.test(lines[stop] ?? '') || (lines[stop] ?? '').trim() === '')) {
    if (/^\s{4}- /.test(lines[stop] ?? '')) starts.push(stop);
    stop += 1;
  }
  const from = starts[index];
  if (from === undefined) return { ok: false, message: 'Карта не найдена в `maps.custom`.' };
  let to = starts[index + 1] ?? stop;
  while (to > from + 1 && (lines[to - 1] ?? '').trim() === '') to -= 1;
  const rest = [...lines.slice(0, from), ...lines.slice(to)];
  // Список опустел — остаётся `custom: []`, а не висящий ключ.
  if (starts.length === 1) rest[custom] = '  custom: []';
  return { ok: true, text: rest.join(eol) };
}
