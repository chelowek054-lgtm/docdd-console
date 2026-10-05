import { globCovers, globMatch } from './glob';
import type { ArchitectureConfig } from './types';

/**
 * Точная проверка архитектуры по карте кода (docs/07-maps.md, «Модули и
 * публичный вход»; docs/adr/0013-modules-with-public-entry.md). Чистая функция:
 * какие файлы существуют и какие импорты подтверждены, ей приходит снаружи.
 * Код не разбирается — сверяются пути, как и в остальных картах (ADR-0007).
 *
 * Модуль — каталог с файлом-входом по соглашению языка. Файл принадлежит
 * ближайшему каталогу-модулю вверх по дереву; цепочка «ближайший → самый внешний»
 * и есть вся иерархия, которая нужна правилам.
 */

export type ArchCode =
  | 'arch_entry_bypassed'
  | 'arch_parent_import'
  | 'arch_sibling_import'
  | 'arch_cycle'
  | 'arch_shared_imports_domain'
  | 'arch_kernel_imports_domain'
  | 'arch_layer_up'
  | 'arch_slice_cross'
  | 'arch_promote'
  | 'arch_private_import'
  | 'arch_not_independent'
  | 'arch_forbidden';

export interface ArchModuleRef {
  id: string;
  path?: string | undefined;
}

export interface ArchImport {
  from: string;
  to: string;
  /** Карта, объявившая импорт: на ней повисает предупреждение. */
  declaredBy?: string | undefined;
  /** Свидетельство импорта из карты: экран показывает его в карточке нарушения. */
  evidence?: { path: string; line: number; fragment: string } | undefined;
}

export interface ArchFinding {
  code: ArchCode;
  from: string;
  to: string;
  declaredBy?: string | undefined;
  evidence?: ArchImport['evidence'];
  message: string;
}

export interface ArchModule {
  dir: string;
  language: string;
  /** Файл входа модуля: у Go — первый файл пакета. */
  entry: string | null;
  /** Ближайший модуль выше; `null` — модуль верхнего уровня. */
  parent: string | null;
}

export interface ArchResult {
  findings: ArchFinding[];
  /** Сколько импортов удалось проверить из скольких. Остальные — язык без входа или файл не найден. */
  checked: number;
  total: number;
  /** Почему остальные не проверены: язык без входа (`kotlin`), `missing` — файл не найден, `unknown` — расширение не знакомо. */
  unchecked: Record<string, number>;
  modules: ArchModule[];
}

export interface ArchInput {
  config: ArchitectureConfig;
  /** Существующие файлы кода от корня проекта. */
  files: Iterable<string>;
  modules: readonly ArchModuleRef[];
  imports: readonly ArchImport[];
}

const EXTENSION_LANGUAGE: Readonly<Record<string, string>> = {
  py: 'python',
  ts: 'typescript', tsx: 'typescript', js: 'typescript', jsx: 'typescript', mjs: 'typescript', cjs: 'typescript', vue: 'typescript',
  rs: 'rust',
  go: 'go',
  kt: 'kotlin', kts: 'kotlin',
  java: 'java'
};

/** `*` — любой файл каталога (Go: пакет — каталог). У Kotlin и Java соглашения нет. */
export const DEFAULT_ENTRIES: Readonly<Record<string, readonly string[]>> = {
  python: ['__init__.py'],
  typescript: ['index.ts', 'index.tsx', 'index.js'],
  rust: ['mod.rs', 'lib.rs'],
  go: ['*']
};

/** Что по общей конвенции не подлежит проверке границ: тесты, скрипты, миграции (docs/12-practice-rules.md). */
export const BUILTIN_IGNORE: readonly string[] = [
  '**/tests/**', '**/test/**', '**/*.spec.*', '**/*.test.*', '**/migrations/**', '**/scripts/**'
];

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function dirname(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Путь под префиксом — по границе сегмента: `shared` не захватывает `shared-ui`. */
function under(path: string, prefix: string): boolean {
  const clean = normalizePath(prefix);
  return clean !== '' && (path === clean || path.startsWith(`${clean}/`));
}

export function languageOf(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot < 0 || dot < path.lastIndexOf('/')) return null;
  return EXTENSION_LANGUAGE[path.slice(dot + 1).toLowerCase()] ?? null;
}

const NESTED_FILE = /\/[^/]+\.[A-Za-z0-9]+$/;

/** Путь, а не dotted-имя пакета: слеш и расширение, либо файл верхнего уровня с известным расширением. */
function pathLike(id: string): boolean {
  return NESTED_FILE.test(id) || (!id.includes('/') && languageOf(id) !== null);
}

type Klass = 'shared' | 'kernel' | 'domain';

export function checkArchitecture(input: ArchInput): ArchResult {
  const config = input.config;
  const known = new Set<string>();
  for (const file of input.files) known.add(normalizePath(file));
  for (const module of input.modules) {
    if (module.path) known.add(normalizePath(module.path));
    else if (pathLike(module.id)) known.add(normalizePath(module.id));
  }

  const unignore = new Set(config.unignore ?? []);
  const ignorePatterns = [...BUILTIN_IGNORE.filter((pattern) => !unignore.has(pattern)), ...(config.ignore ?? [])];
  const ignored = (path: string) => ignorePatterns.some((pattern) => globCovers(pattern, path));

  /** Вид входа модуля: правило ближайшего каталога вверх, иначе по языку — Python открыт, остальные закрыты. */
  const kindOf = (dir: string, language: string): 'open' | 'closed' => {
    for (let at = dir; at !== ''; at = dirname(at)) {
      const rule = config.modules?.filter((item) => globMatch(item.path, at)).at(-1);
      if (rule) return rule.entry;
    }
    return language === 'python' ? 'open' : 'closed';
  };

  const entryNames = (language: string): readonly string[] | null => config.entries?.[language] ?? DEFAULT_ENTRIES[language] ?? null;
  const isEntry = (path: string, language: string): boolean => {
    const names = entryNames(language);
    return names !== null && (names.includes('*') || names.includes(basename(path)));
  };

  // Каталоги-модули по языкам: каталог с входом этого языка.
  const moduleDirs = new Map<string, Set<string>>();
  for (const file of known) {
    const language = languageOf(file);
    if (!language || !isEntry(file, language)) continue;
    const dir = dirname(file);
    if (dir === '') continue;
    const set = moduleDirs.get(language) ?? new Set<string>();
    set.add(dir);
    moduleDirs.set(language, set);
  }

  /** Цепочка модулей файла: ближайший первым. `null` — языку нечего проверять. */
  const chainOf = (path: string, language: string): string[] | null => {
    if (entryNames(language) === null) return null;
    const dirs = moduleDirs.get(language) ?? new Set<string>();
    const chain: string[] = [];
    for (let dir = dirname(path); dir !== ''; dir = dirname(dir)) {
      if (!dirs.has(dir)) continue;
      chain.push(dir);
      // Go: пакеты не вкладываются — вложенный каталог такой же пакет, а не подмодуль.
      if (language === 'go') break;
    }
    return chain;
  };

  const resolve = (id: string): string | null => {
    const declared = input.modules.find((module) => module.id === id)?.path;
    if (declared) return normalizePath(declared);
    if (pathLike(id)) return normalizePath(id);
    // dotted-имя пакета без пути: `knowledge.repeat` → `…/knowledge/repeat.py` или `…/__init__.py`.
    const base = id.replace(/\./g, '/');
    for (const candidate of [`${base}.py`, `${base}/__init__.py`]) {
      for (const file of known) {
        if (file === candidate || file.endsWith(`/${candidate}`)) return file;
      }
    }
    return null;
  };

  const classOf = (path: string): Klass => {
    if (config.kernel?.some((prefix) => under(path, prefix))) return 'kernel';
    if (config.shared?.some((prefix) => under(path, prefix))) return 'shared';
    return 'domain';
  };

  const profileOf = (path: string) => config.layers?.find((profile) => under(path, profile.root));
  const layerPosition = (path: string, profile: NonNullable<ArchitectureConfig['layers']>[number]) => {
    const rest = path.slice(normalizePath(profile.root).length + 1).split('/');
    const layer = rest[0] ?? '';
    // Слои без срезов (по FSD — app и shared): сегменты внутри друг друга видят.
    const sliced = !(profile.unsliced ?? []).includes(layer);
    return { index: profile.order.indexOf(layer), layer, slice: sliced && rest.length > 2 ? rest[1] : null, rest };
  };

  const via = config.siblings ?? 'via-entry';
  const findings: ArchFinding[] = [];
  const unchecked: Record<string, number> = {};
  const skip = (reason: string) => { unchecked[reason] = (unchecked[reason] ?? 0) + 1; };
  let checked = 0;

  interface Crossing { import: ArchImport; fromPath: string; toPath: string; fromChain: string[]; toChain: string[] }
  const crossings: Crossing[] = [];

  for (const item of input.imports) {
    const fromPath = resolve(item.from);
    const toPath = resolve(item.to);
    if (!fromPath || !toPath || !known.has(fromPath) || !known.has(toPath)) { skip('missing'); continue; }
    if (ignored(fromPath) || ignored(toPath)) { skip('ignored'); continue; }
    const language = languageOf(fromPath);
    if (!language || language !== languageOf(toPath)) { skip(language ?? 'unknown'); continue; }
    const fromChain = chainOf(fromPath, language);
    const toChain = chainOf(toPath, language);
    if (!fromChain || !toChain) { skip(language); continue; }
    checked += 1;
    if (fromPath === toPath) continue;
    crossings.push({ import: item, fromPath, toPath, fromChain, toChain });

    const at = (code: ArchCode, message: string) =>
      findings.push({ code, from: item.from, to: item.to, declaredBy: item.declaredBy, evidence: item.evidence, message });
    const names = (entryNames(language) ?? []).join(', ');

    const fromClass = classOf(fromPath);
    const toClass = classOf(toPath);
    if (fromClass === 'shared' && toClass !== 'shared') {
      at('arch_shared_imports_domain', `Технический общий код \`${fromPath}\` импортирует \`${toPath}\` — ${toClass === 'kernel' ? 'общее бизнес-ядро' : 'доменный модуль'}. \`shared\` домена не знает: вынесите нужное в \`shared\` или переверните зависимость.`);
      continue;
    }
    if (fromClass === 'kernel' && toClass === 'domain') {
      at('arch_kernel_imports_domain', `Бизнес-ядро \`${fromPath}\` импортирует доменный модуль \`${toPath}\`. \`kernel\` зависит только от \`shared\`: доменное должно идти к нему, а не от него.`);
      continue;
    }

    const banned = config.forbidden?.find((rule) => globCovers(rule.from, fromPath) && rule.to.some((to) => globCovers(to, toPath)));
    if (banned) {
      at('arch_forbidden', `Импорт \`${fromPath}\` → \`${toPath}\` запрещён правилом${banned.source ? ` ${banned.source}` : ''}${banned.why ? `: ${banned.why}` : ''}.`);
      continue;
    }

    // Слои: оба конца в одном профиле и в известных слоях.
    let governed = false;
    const profile = profileOf(fromPath);
    if (profile && profile === profileOf(toPath)) {
      const a = layerPosition(fromPath, profile);
      const b = layerPosition(toPath, profile);
      if (a.index >= 0 && b.index >= 0) {
        governed = true;
        if (b.index < a.index) {
          at('arch_layer_up', `Слой \`${a.layer}\` импортирует вышележащий слой \`${b.layer}\` (\`${toPath}\`). Порядок сверху вниз: ${profile.order.join(' → ')}, импорт идёт только вниз.`);
          continue;
        }
        if (b.index === a.index && a.slice && b.slice && a.slice !== b.slice
          && (profile.slices ?? 'isolated') === 'isolated' && !b.rest.includes('@x')) {
          at('arch_slice_cross', `Срез \`${a.layer}/${a.slice}\` импортирует соседний срез \`${b.layer}/${b.slice}\` того же слоя. Срезы одного слоя друг друга не знают (исключение — каталог \`@x\`): общее поднимите на слой ниже.`);
          continue;
        }
      }
    }

    const owner = toChain[0];
    if (owner !== undefined && fromChain.includes(owner) && owner !== fromChain[0]) {
      at('arch_parent_import', `Подмодуль \`${fromChain[0]}\` импортирует своего родителя \`${owner}\` (\`${toPath}\`). Родитель собирает детей, а не наоборот: нужное детям вынесите в общий модуль ниже.`);
      continue;
    }

    const crossedTo = toChain.filter((dir) => !fromChain.includes(dir));
    const crossedFrom = fromChain.filter((dir) => !toChain.includes(dir));
    const outerTo = crossedTo.at(-1);
    const outerFrom0 = crossedFrom.at(-1);

    // Независимые модули друг друга не знают, даже через вход.
    if (outerFrom0 !== undefined && outerTo !== undefined && outerFrom0 !== outerTo
      && config.independent?.some((pattern) => globMatch(pattern, outerFrom0) && globMatch(pattern, outerTo))) {
      at('arch_not_independent', `Модули \`${outerFrom0}\` и \`${outerTo}\` объявлены независимыми, а один обращается к другому. Их связывает родитель или общий код ниже.`);
      continue;
    }

    // Снаружи внутрь: закрытый модуль пускает только во вход, открытый — в публичные подмодули.
    let handled = false;
    for (const dir of [...crossedTo].reverse()) {
      if (kindOf(dir, language) === 'closed') {
        // `@x` — явный публичный вход соседа в FSD (кросс-импорт у entities), а не внутренность.
        const publicCross = toPath.slice(dir.length + 1).split('/')[0] === '@x';
        if (!publicCross && !(dirname(toPath) === dir && isEntry(toPath, language))) {
          at('arch_entry_bypassed', `Импорт \`${toPath}\` идёт в глубину модуля \`${dir}\`, в обход его входа (\`${names}\`). Обращайтесь к входу \`${dir}\` — или опубликуйте нужное через него.`);
          handled = true;
        }
        break;
      }
      const inside = toPath.slice(dir.length + 1).split('/').map((part, index, all) => (index === all.length - 1 ? part.replace(/\.[^.]+$/, '') : part));
      const privatePart = inside.find((part) => part.startsWith('_') && !part.startsWith('__'));
      if (privatePart) {
        at('arch_private_import', `Импорт \`${toPath}\` берёт приватное (\`${privatePart}\`) из модуля \`${dir}\`. Публично только то, что без \`_\` в имени: используйте публичный подмодуль или вход.`);
        handled = true;
        break;
      }
    }
    if (handled) continue;
    const outerFrom = crossedFrom.at(-1);
    if (via === 'via-parent' && !governed && fromClass === 'domain' && toClass === 'domain'
      && outerFrom !== undefined && outerTo !== undefined) {
      at('arch_sibling_import', `Соседние модули \`${outerFrom}\` и \`${outerTo}\` обращаются друг к другу, а в проекте \`siblings: via-parent\`. Их связывает родитель: пусть он передаёт нужное.`);
    }
  }

  // Циклы: рёбра между соседями под общим родителем.
  type Edge = { crossing: Crossing; a: string; b: string; parent: string };
  const edges: Edge[] = [];
  for (const crossing of crossings) {
    const crossedTo = crossing.toChain.filter((dir) => !crossing.fromChain.includes(dir));
    const crossedFrom = crossing.fromChain.filter((dir) => !crossing.toChain.includes(dir));
    const a = crossedFrom.at(-1);
    const b = crossedTo.at(-1);
    if (a === undefined || b === undefined) continue;
    if (classOf(a) !== 'domain' || classOf(b) !== 'domain') continue;
    const common = crossing.fromChain.find((dir) => crossing.toChain.includes(dir)) ?? '';
    edges.push({ crossing, a, b, parent: common });
  }
  const outgoing = new Map<string, Set<string>>();
  for (const edge of edges) {
    const key = `${edge.parent}|${edge.a}`;
    outgoing.set(key, (outgoing.get(key) ?? new Set()).add(edge.b));
  }
  const reaches = (parent: string, start: string, goal: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const at = stack.pop() as string;
      if (at === goal) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      stack.push(...(outgoing.get(`${parent}|${at}`) ?? []));
    }
    return false;
  };
  for (const edge of edges) {
    if (!reaches(edge.parent, edge.b, edge.a)) continue;
    const { import: item } = edge.crossing;
    findings.push({
      code: 'arch_cycle', from: item.from, to: item.to, declaredBy: item.declaredBy, evidence: item.evidence,
      message: `Модули \`${edge.a}\` и \`${edge.b}\` зависят друг от друга по кругу. Разорвите цикл: общее вынесите в третий модуль или оставьте зависимость в одну сторону.`
    });
  }

  // Подсказка «поднять»: внутренность модуля нужна и снаружи его родителя.
  const parentOf = (dir: string, language: string): string | null => {
    // Go: пакеты не вкладываются, у пакета нет родителя-модуля.
    if (language === 'go') return null;
    const dirs = moduleDirs.get(language) ?? new Set<string>();
    for (let up = dirname(dir); up !== ''; up = dirname(up)) if (dirs.has(up)) return up;
    return null;
  };
  const promoted = new Map<string, { first: ArchImport; to: string; consumers: Set<string> }>();
  for (const crossing of crossings) {
    const language = languageOf(crossing.toPath) as string;
    for (const dir of crossing.toChain) {
      if (crossing.fromChain.includes(dir)) continue;
      if (classOf(dir) !== 'domain') continue;
      const parent = parentOf(dir, language);
      if (parent === null) continue;
      if (under(crossing.fromPath, parent)) continue;
      const entry = promoted.get(dir) ?? { first: crossing.import, to: crossing.toPath, consumers: new Set<string>() };
      entry.consumers.add(crossing.fromPath);
      promoted.set(dir, entry);
    }
  }
  for (const [dir, entry] of promoted) {
    // Все, кто пользуется модулем (и снаружи, и из родителя): общий предок считается по ним всем.
    const everyone = new Set(entry.consumers);
    for (const crossing of crossings) {
      if (crossing.toChain.includes(dir) && !crossing.fromChain.includes(dir)) everyone.add(crossing.fromPath);
    }
    let ancestor = dir;
    for (const consumer of everyone) {
      while (ancestor !== '' && !under(consumer, ancestor)) ancestor = dirname(ancestor);
    }
    // Поднимать некуда, кроме модуля: каталог без входа — не предок, а корень.
    const language = [...moduleDirs].find(([, dirs]) => dirs.has(dir))?.[0] ?? '';
    while (ancestor !== '' && !(moduleDirs.get(language)?.has(ancestor))) ancestor = dirname(ancestor);
    const target = ancestor === ''
      ? 'в `shared` (если код технический) или в `kernel` (если это общее бизнес-понятие)'
      : `к \`${ancestor}\``;
    findings.push({
      code: 'arch_promote', from: entry.first.from, to: entry.to, declaredBy: entry.first.declaredBy, evidence: entry.first.evidence,
      message: `Модуль \`${dir}\` лежит внутри родителя, а им пользуются и снаружи (${[...entry.consumers].slice(0, 3).map((path) => `\`${path}\``).join(', ')}). Поднимите его ${target}: ближайший общий предок всех, кто им пользуется.`
    });
  }

  const modules: ArchModule[] = [];
  for (const [language, dirs] of moduleDirs) {
    for (const dir of [...dirs].sort()) {
      const entry = [...known].filter((file) => dirname(file) === dir && languageOf(file) === language && isEntry(file, language)).sort()[0] ?? null;
      modules.push({ dir, language, entry, parent: parentOf(dir, language) });
    }
  }

  return { findings, checked, total: input.imports.length, unchecked, modules };
}

// --- аудит моделью ---

/** Что граф импортов не видит и о чём судит модель (docs/prompts/architecture-audit.md). */
export const AUDIT_KINDS = ['logic_in_ui', 'duplicate', 'many_tasks', 'leaky_entry', 'no_entry_use', 'misplaced'] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export const AUDIT_KIND_LABEL: Readonly<Record<AuditKind, string>> = {
  logic_in_ui: 'логика в интерфейсе',
  duplicate: 'повтор вместо общего',
  many_tasks: 'несколько задач в модуле',
  leaky_entry: 'вход отдаёт лишнее',
  no_entry_use: 'внутренность снаружи',
  misplaced: 'файл не на месте'
};

export interface AuditFinding {
  path: string;
  kind: AuditKind;
  note: string;
}

export interface AuditResult {
  findings: AuditFinding[];
  /** Что в ответе не взято и почему: молча терять находки нельзя. */
  skipped: { path: string; reason: string }[];
}

const AUDIT_BLOCK = /```docdd-architecture\s*\n([\s\S]*?)```/;

/**
 * Ответ модели на аудит: блок `docdd-architecture`. Это мнение, а не свидетельство:
 * ничего не пишется, а то, что не сошлось с проектом (нет такого пути, вид не из
 * списка), показывается как «пропущено» с причиной. Блока нет или он не
 * разбирается — `null`: экран покажет ответ текстом, как раньше.
 */
export function parseArchitectureAudit(answer: string, files: Iterable<string>): AuditResult | null {
  const match = AUDIT_BLOCK.exec(answer);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch {
    return null;
  }
  const list = (parsed as { findings?: unknown } | null)?.findings;
  if (!Array.isArray(list)) return null;

  const known = [...files].map(normalizePath);
  const exists = (path: string) => known.some((file) => file === path || file.startsWith(`${path}/`));
  const findings = new Map<string, AuditFinding>();
  const skipped: AuditResult['skipped'] = [];

  for (const raw of list) {
    const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const path = typeof entry['path'] === 'string' ? normalizePath(entry['path'].trim()) : '';
    const kind = entry['kind'];
    if (!path) { skipped.push({ path: '(без пути)', reason: 'не назван путь' }); continue; }
    if (!AUDIT_KINDS.includes(kind as AuditKind)) { skipped.push({ path, reason: `вид не из списка: ${AUDIT_KINDS.join(', ')}` }); continue; }
    if (!exists(path)) { skipped.push({ path, reason: 'такого файла или каталога нет в проекте' }); continue; }
    findings.set(`${path}|${String(kind)}`, {
      path, kind: kind as AuditKind, note: typeof entry['note'] === 'string' ? entry['note'].trim() : ''
    });
  }
  return { findings: [...findings.values()], skipped };
}

// --- задача «Починить нарушения» ---

export interface FixableFinding {
  code: string;
  from: string;
  to: string;
  evidence?: { path: string; line: number } | undefined;
  map?: string | undefined;
  message: string;
}

/** Состояние общей галочки «Выбрать все»: все отмечены, ни одной или часть. */
export function selectionState(total: number, chosen: number): boolean | 'indeterminate' {
  if (total > 0 && chosen >= total) return true;
  return chosen === 0 ? false : 'indeterminate';
}

export interface FixTask {
  title: string;
  /** Готовый текст раздела задачи: список из проверки, а не пересказ модели. */
  body: string;
  /** Карты, объявившие эти импорты: на них висят нарушения. */
  affects: string[];
  count: number;
}

/**
 * Задача на отмеченные нарушения (docs/04-ui.md, «Архитектура на карте кода»).
 * Подсказка «поднять» (`arch_promote`) в неё не входит — это решение человека, а не
 * нарушение. Пусто — `null`: кнопка неактивна и называет причину.
 */
export function fixTaskOf(findings: readonly FixableFinding[]): FixTask | null {
  const chosen = findings.filter((item) => item.code !== 'arch_promote');
  if (chosen.length === 0) return null;

  const lines = chosen.map((item) => {
    const where = item.evidence ? `\`${item.evidence.path}:${item.evidence.line}\`` : `\`${item.from}\``;
    return `- \`${item.code}\` — ${where}: ${item.message}`;
  });
  const body = [
    'Нарушения правил архитектуры из точной проверки по подтверждённой карте кода',
    '(docs/07-maps.md, «Модули и публичный вход»). Правится код, а не карты: после правки',
    'импорты в картах нужно переописать.',
    '',
    ...lines
  ].join('\n');

  return {
    title: `Починить нарушения архитектуры: ${chosen.length}`,
    body,
    affects: [...new Set(chosen.map((item) => item.map).filter((id): id is string => !!id))].sort(),
    count: chosen.length
  };
}
