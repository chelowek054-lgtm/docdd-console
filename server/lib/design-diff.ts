import { MIN_CONTRAST, paletteContrast, type PlainTokens } from './design';
import { exportStack, lineDiff, STACK_LABEL, type StackId } from './design-export';

/**
 * Разница токенов дизайна у записи на подтверждении (R-0073): палитра «было / станет»,
 * контраст до и после, файлы выгрузки по стекам, которые поменяются. Чистые функции
 * над двумя плоскими видами токенов — «было» и «станет» собирает вызывающий.
 */

export type ChangeState = 'added' | 'removed' | 'changed' | 'same';

export interface PaletteRow { role: string; before: string | null; after: string | null; state: ChangeState }
export interface PaletteDiff { theme: string; rows: PaletteRow[] }

export interface ContrastDiffRow {
  theme: string;
  pair: [string, string];
  before: number | null;
  after: number | null;
  okBefore: boolean | null;
  okAfter: boolean | null;
  /** Порог, против которого сверяется «станет». */
  min: number;
  /** Контраст упал ниже порога из-за записи — то, чего человек ждёт увидеть первым. */
  regressed: boolean;
}

export interface ExportFileDiff { key: string; defaultPath: string; state: 'added' | 'changed'; diff: string }
export interface StackDiff { id: StackId; label: string; files: ExportFileDiff[] }

export interface DesignDiff {
  palette: PaletteDiff[];
  contrast: ContrastDiffRow[];
  stacks: StackDiff[];
}

const stateOf = (before: string | null, after: string | null): ChangeState =>
  before === null ? (after === null ? 'same' : 'added') : after === null ? 'removed' : before === after ? 'same' : 'changed';

function palettes(tokens: PlainTokens): Record<string, Record<string, string>> {
  return {
    light: tokens.palette.light,
    dark: tokens.palette.dark,
    ...Object.fromEntries(Object.entries(tokens.themes).map(([name, theme]) => [name, theme.palette]))
  };
}

/** Палитры по темам: базовые и добавленные, роль за ролью; темы без изменений не приходят. */
export function paletteDiff(before: PlainTokens, after: PlainTokens): PaletteDiff[] {
  const was = palettes(before);
  const now = palettes(after);
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].map((theme) => {
    const a = was[theme] ?? {};
    const b = now[theme] ?? {};
    const rows = [...new Set([...Object.keys(a), ...Object.keys(b)])].map((role): PaletteRow => {
      const x = a[role] ?? null;
      const y = b[role] ?? null;
      return { role, before: x, after: y, state: stateOf(x, y) };
    });
    return { theme, rows };
  }).filter((item) => item.rows.some((row) => row.state !== 'same'));
}

/** Контраст пар «до» и «после» по каждой теме, где что-то поменялось. */
export function contrastDiff(before: PlainTokens, after: PlainTokens): ContrastDiffRow[] {
  const was = palettes(before);
  const now = palettes(after);
  const minOf = (tokens: PlainTokens, theme: string) => tokens.themes[theme]?.minContrast ?? MIN_CONTRAST;
  const out: ContrastDiffRow[] = [];
  for (const { theme } of paletteDiff(before, after)) {
    const rowsOf = (tokens: PlainTokens, source: Record<string, Record<string, string>>) =>
      new Map(paletteContrast(source[theme] ?? {}, minOf(tokens, theme)).map((row) => [row.pair.join('/'), row]));
    const x = rowsOf(before, was);
    const y = rowsOf(after, now);
    for (const key of new Set([...x.keys(), ...y.keys()])) {
      const a = x.get(key);
      const b = y.get(key);
      const shown = (b ?? a)!;
      out.push({
        theme,
        pair: shown.pair,
        before: a ? a.ratio : null,
        after: b ? b.ratio : null,
        okBefore: a ? a.ok : null,
        okAfter: b ? b.ok : null,
        min: shown.min,
        regressed: Boolean(b && !b.ok && (!a || a.ok))
      });
    }
  }
  return out.filter((row) => row.before === null || row.after === null || Math.abs(row.before - row.after) > 0.005);
}

/** Какие файлы выгрузки поменяются: выгрузка «до» против выгрузки «после», по стекам манифеста. */
export function stackDiff(before: PlainTokens, after: PlainTokens, stacks: readonly { id: StackId; package?: string | undefined }[]): StackDiff[] {
  return stacks.map((stack) => {
    const was = new Map(exportStack(stack.id, before, { package: stack.package }).files.map((file) => [file.key, file]));
    const files: ExportFileDiff[] = [];
    for (const file of exportStack(stack.id, after, { package: stack.package }).files) {
      const old = was.get(file.key);
      if (old?.content === file.content) continue;
      files.push({ key: file.key, defaultPath: file.defaultPath, state: old ? 'changed' : 'added', diff: lineDiff(old?.content ?? '', file.content, 60) });
    }
    return { id: stack.id, label: STACK_LABEL[stack.id], files };
  }).filter((item) => item.files.length > 0);
}

export function designDiff(before: PlainTokens, after: PlainTokens, stacks: readonly { id: StackId; package?: string | undefined }[] = []): DesignDiff {
  return { palette: paletteDiff(before, after), contrast: contrastDiff(before, after), stacks: stackDiff(before, after, stacks) };
}
