/** Ответ HTTP API консоли: инструменты не знают про fetch и проверяются без сервера. */
export interface ApiAnswer { ok: boolean; status: number; data: unknown }

export interface ApiClient {
  get(path: string): Promise<ApiAnswer>;
  post(path: string, body: unknown): Promise<ApiAnswer>;
}

export interface ToolContext {
  api: ApiClient;
  projectId: string;
}

/** Схема входа инструмента — JSON Schema: её без изменений получает клиент MCP. */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** `write` работает только при включённом входе и от лица агента (A-0002). */
  access: 'read' | 'write';
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export interface ToolOutcome { text: string; isError: boolean }
