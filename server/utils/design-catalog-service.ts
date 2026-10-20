import { buildCatalogReport, catalogSources, type CatalogReport } from '../lib/design-catalog';
import { STACK_LABEL, exportStack, isStackId, projectFilePath } from '../lib/design-export';
import { plainTokens } from '../lib/design';
import { portPrompt, storyPairs, type StoryPair } from '../lib/design-port';
import { listFiles } from './design-screens-service';
import { normalizeRoot } from '../lib/paths';
import { readManifest, sourceReader } from '../lib/workspace';
import { projectDesign } from './design-service';

/**
 * Матрица «компонент × состояние × стек» по выгрузкам каталогов историй
 * (docs/16-design-system.md, «Storybook как контракт»). Выгрузки читаются из
 * корня проекта (`sourceReader` не выходит за него); Storybook не запускается.
 * `null` — каталоги в манифесте не объявлены, сверять не с чем.
 */
export function projectCatalog(root: string): CatalogReport | null {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const sources = catalogSources(manifest.design, STACK_LABEL, sourceReader(normalized));
  if (sources.length === 0) return null;
  const design = projectDesign(normalized);
  return buildCatalogReport(design.tokens.components.map((item) => item.value), sources);
}

/** Пары «эталон истории — снимок стека» для запроса Pixel-Perfect; пусто, если каталоги или снимки не объявлены. */
export function projectStoryPairs(root: string): StoryPair[] {
  const normalized = normalizeRoot(root);
  const dir = readManifest(normalized).design?.snapshots;
  const report = projectCatalog(normalized);
  if (!dir || !report) return [];
  return storyPairs(report, dir, new Set(listFiles(normalized, dir).map((file) => file.path)));
}

export class PortError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

/**
 * Запрос «перенести компонент на стек» (R-0057): контракт из реестра, истории
 * и снимки из каталогов, токены стека из выгрузки. Ничего не пишет в проект.
 */
export function projectPortPrompt(root: string, template: string, componentName: string, stackId: string, branch: string): string {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const design = projectDesign(normalized);
  if (design.empty) throw new PortError('design_empty', 'У проекта нет токенов дизайна: переносить не по чему');
  const components = design.tokens.components.map((item) => item.value);
  const component = components.find((item) => item.name === componentName);
  if (!component) throw new PortError('component_unknown', `Компонента \`${componentName}\` нет в реестре дизайна`);
  if (!isStackId(stackId) || !(manifest.design?.stacks ?? []).some((stack) => stack.id === stackId)) {
    throw new PortError('stack_unknown', `Стек \`${stackId}\` в манифесте не объявлен`);
  }
  const stack = (manifest.design?.stacks ?? []).find((item) => item.id === stackId);
  const report = projectCatalog(normalized) ?? { columns: [], rows: [], findings: [], storiesOf: {} };
  const output = exportStack(stackId, plainTokens(design.tokens), { package: stack?.package });
  const snapshotsDir = manifest.design?.snapshots;
  return portPrompt(template, {
    component,
    stack: stackId,
    stackLabel: STACK_LABEL[stackId],
    report,
    tokenFiles: output.files.map((file) => ({ path: projectFilePath(stack?.files, file), content: file.content })),
    components,
    branch,
    ...(snapshotsDir ? { snapshotsDir, files: new Set(listFiles(normalized, snapshotsDir).map((file) => file.path)) } : {})
  });
}
