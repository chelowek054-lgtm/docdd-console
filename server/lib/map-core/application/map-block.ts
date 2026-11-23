/**
 * Блок записи карты из узлов и связей — без зависимостей от сервера: его собирают и инструменты MCP
 * (`mcp-maps.ts`), и редактор карты в браузере (R-0142, R-0144). Разбор и линтер — на сервере.
 */

export type MapTarget = { kind: 'strategic' } | { kind: 'custom'; id: string };

export interface MapNode {
  id: string; title?: string; summary?: string; parent?: string; kind?: string;
  status?: string; note?: string; priority?: string; horizon?: string;
}

export interface MapEdge { from: string; to: string; type: string; summary?: string }

export interface MapPart { nodes?: MapNode[]; edges?: MapEdge[] }

/** Блок записи карты: стратегическая — `docdd-functional`, пользовательская — `docdd-custom` с `map`. */
export function blockText(target: MapTarget, added: MapPart, removed: MapPart = {}): string {
  const part = (side: MapPart) => {
    const nodes = side.nodes?.length ? side.nodes : undefined;
    const edges = side.edges?.length ? side.edges : undefined;
    if (!nodes && !edges) return undefined;
    return target.kind === 'strategic'
      ? { ...(nodes ? { capabilities: nodes } : {}), ...(edges ? { relations: edges } : {}) }
      : { ...(nodes ? { nodes } : {}), ...(edges ? { relations: edges } : {}) };
  };
  const addedPart = part(added);
  const removedPart = part(removed);
  const body = {
    ...(target.kind === 'custom' ? { map: target.id } : {}),
    ...(addedPart ? { added: addedPart } : {}),
    ...(removedPart ? { removed: removedPart } : {})
  };
  const fence = target.kind === 'strategic' ? 'docdd-functional' : 'docdd-custom';
  return `\`\`\`${fence}\n${JSON.stringify(body, null, 2)}\n\`\`\`\n`;
}
