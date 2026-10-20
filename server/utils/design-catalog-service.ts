import { buildCatalogReport, catalogSources, type CatalogReport } from '../lib/design-catalog';
import { STACK_LABEL } from '../lib/design-export';
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
