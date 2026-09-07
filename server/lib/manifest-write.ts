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
