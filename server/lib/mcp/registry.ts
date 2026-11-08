import type { McpTool, ToolContext, ToolOutcome } from './types';

export interface ToolRegistry {
  tools: readonly McpTool[];
  find(name: string): McpTool | undefined;
}

/** Два инструмента с одним именем — ошибка запуска: клиент молча увидел бы только один из них. */
export function createRegistry(tools: readonly McpTool[]): ToolRegistry {
  const byName = new Map<string, McpTool>();
  for (const tool of tools) {
    if (byName.has(tool.name)) throw new Error(`Инструмент MCP \`${tool.name}\` объявлен дважды`);
    byName.set(tool.name, tool);
  }
  const sorted = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { tools: sorted, find: (name) => byName.get(name) };
}

/** Токен не должен дойти до модели даже внутри сообщения об ошибке (A-0002). */
function withoutSecret(text: string, secret: string | undefined): string {
  return secret ? text.split(secret).join('[скрыто]') : text;
}

export const READ_ONLY_REASON = 'MCP работает только на чтение: запись доступна при включённом входе (DOCDD_AUTH=on) и токене агента в DOCDD_AGENT_TOKEN.';

export async function callTool(
  registry: ToolRegistry,
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  options: { writable: boolean; secret?: string | undefined }
): Promise<ToolOutcome> {
  const tool = registry.find(name);
  if (!tool) return { text: `Инструмента \`${name}\` нет`, isError: true };
  if (tool.access === 'write' && !options.writable) return { text: READ_ONLY_REASON, isError: true };
  try {
    return { text: withoutSecret(await tool.run(args, ctx), options.secret), isError: false };
  } catch (error) {
    return { text: withoutSecret(error instanceof Error ? error.message : String(error), options.secret), isError: true };
  }
}
