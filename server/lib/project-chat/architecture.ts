import { buildProjectMap } from '../../utils/map-service';
import { compareProjectDesign } from '../../utils/system-design-service';

export function chatArchitecture(root: string) {
  const { sysdesign, codemap, functional } = buildProjectMap(root);
  const differences = compareProjectDesign(root);
  const strategyStatuses: Record<string, number> = Object.create(null);
  for (const item of functional.capabilities) {
    const status = item.pending ? 'pending' : item.status ?? 'unknown';
    strategyStatuses[status] = (strategyStatuses[status] ?? 0) + 1;
  }
  return {
    systemDesignNodes: sysdesign.nodes.length,
    codeModules: codemap.modules.length,
    strategyStatuses,
    differenceTotal: differences.length,
    differences: differences.slice(0, 12).map(({ code, location, detail }) => ({ code, location, detail: detail.slice(0, 220) }))
  };
}
