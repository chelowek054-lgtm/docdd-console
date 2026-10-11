import { analyze } from '../lib/analyze';
import { BUILTIN_SOURCE, withBuiltin } from '../lib/builtin';
import { compareVersions, plainTokens, resolveDesign, type DesignChange, type DesignRecord, type DesignResolution } from '../lib/design';
import {
  compareFile,
  componentsMissing,
  exportStack,
  isSafeRelative,
  projectFilePath,
  providedComponents,
  STACK_LABEL,
  versionOfFile,
  type FileState,
  type StackId
} from '../lib/design-export';
import { normalizeRoot } from '../lib/paths';
import { readManifest, readWorkspace, sourceReader } from '../lib/workspace';
import { generalRuleRecords } from './rules-service';

/**
 * Токены дизайна проекта (docs/16-design-system.md, ADR-0022). Общие записи
 * читаются тем же путём, что и правила из практик: источники `sources.shared`
 * по тегам, только подтверждённое. Здесь — сборка входа для чистых функций
 * `resolveDesign` и `exportStack`, самой логики нет.
 */

export interface ProjectDesign extends DesignResolution {
  /** Проект получает токены из общего источника: нашёлся подтверждённый блок уровня `general`. */
  connected: boolean;
  /** Компоненты реестра, которых нет в коде; `null` — искать негде. */
  componentsMissing: string[] | null;
  /** Стеки, объявленные в манифесте. */
  stacks: { id: StackId; label: string }[];
}

function connectedOf(resolution: DesignResolution): boolean {
  return resolution.sources.some((source) => source.level === 'general');
}

/** Токены проекта после сложения «общее → локальное». Производное: нигде не хранится. */
export function projectDesign(root: string): ProjectDesign {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const workspace = readWorkspace(normalized);
  const { records } = analyze({ files: workspace.files, manifest });
  const local: DesignRecord[] = records
    .filter((record) => (record.type === 'decision' || record.type === 'design') && record.status === 'approved')
    .map((record) => ({ id: record.id, body: record.body }));
  const general = generalRuleRecords(withBuiltin(manifest.sources?.shared ?? []));
  const resolution = resolveDesign({ general, local });

  const names = resolution.tokens.components.map((item) => item.value.name);
  return {
    ...resolution,
    connected: connectedOf(resolution),
    componentsMissing: resolution.empty ? null : componentsMissing(names, workspace.codeFiles, providedComponents(manifest.design?.stacks)),
    stacks: (manifest.design?.stacks ?? []).map((stack) => ({ id: stack.id, label: STACK_LABEL[stack.id] }))
  };
}

/**
 * Эталон консоли: подтверждённые записи встроенного источника с тегом `design`,
 * без локальных. Показывается на глобальном экране «Дизайн» независимо от того,
 * подключил ли его какой-нибудь проект.
 */
export function standardDesign(): DesignResolution | null {
  const general = generalRuleRecords([{ path: BUILTIN_SOURCE, tags: ['design'] }]);
  const resolution = resolveDesign({ general, local: [] });
  return resolution.empty ? null : resolution;
}

export interface StackReport {
  id: StackId;
  label: string;
  /** Версия токенов, из которой собрана выгрузка. */
  version: string;
  /** Изменения новее версии, на которой остался самый отставший файл проекта. */
  changes: DesignChange[];
  files: {
    key: string;
    path: string;
    content: string;
    state: FileState;
    diff: string;
    /** Версия токенов из шапки файла проекта; `null` — шапки нет или файла нет. */
    fileVersion: string | null;
  }[];
}

/**
 * Выгрузка токенов проекта в объявленные стеки и сверка файлов темы. Файл в
 * проекте приложение не пишет (ADR-0022): только читает и сравнивает.
 */
export function projectExports(root: string, only?: string): StackReport[] {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const design = projectDesign(normalized);
  const tokens = plainTokens(design.tokens);
  const read = sourceReader(normalized);

  return (manifest.design?.stacks ?? [])
    .filter((stack) => !only || stack.id === only)
    .map((stack) => {
      const output = exportStack(stack.id, tokens, { package: stack.package });
      const files = output.files.map((file) => {
        const path = projectFilePath(stack.files, file);
        if (!isSafeRelative(path)) {
          return { key: file.key, path, content: file.content, state: 'unknown' as const, diff: '', fileVersion: null };
        }
        const text = read(path);
        const outcome = compareFile(file, text);
        return { key: file.key, path, content: file.content, state: outcome.state, diff: outcome.diff, fileVersion: versionOfFile(text) };
      });
      // Файл без шапки с версией считается самым старым: изменения называются все.
      const known = files.map((file) => file.fileVersion).filter((value): value is string => value !== null);
      const oldest = files.some((file) => file.state !== 'missing' && file.fileVersion === null)
        ? null
        : known.sort(compareVersions)[0] ?? null;
      return {
        id: stack.id,
        label: STACK_LABEL[stack.id],
        version: tokens.version,
        changes: tokens.changes.filter((change) => oldest === null || compareVersions(change.version, oldest) > 0),
        files
      };
    });
}
