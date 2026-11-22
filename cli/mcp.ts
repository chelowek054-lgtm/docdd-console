// MCP-сервер консоли (R-0107, A-0002). stdout занят протоколом: сообщения — только в stderr.
// Окружение: DOCDD_PROJECT (обязательно), DOCDD_URL, DOCDD_AGENT_TOKEN. Подключение: docs/17-mcp.md.
import { dirname, join } from 'node:path'
import { env, exit, stderr } from 'node:process'
import { fileURLToPath } from 'node:url'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { writeAccess } from '../server/lib/confirmation'
import { callTool, createApiClient, createRegistry, loadTools } from '../server/lib/mcp'

const projectId = env['DOCDD_PROJECT'] ?? ''
if (!projectId) {
  stderr.write('Не задан DOCDD_PROJECT: id проекта из списка консоли.\n')
  exit(2)
}
const baseUrl = (env['DOCDD_URL'] ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')
const token = env['DOCDD_AGENT_TOKEN'] || undefined
const api = createApiClient({ baseUrl, token })

/**
 * Запись: со входом — только токен агента, без входа — только консоль на localhost (A-0008, R-0134).
 * Подтверждение человека инструменты несут сами, в поле confirmation.
 */
async function access(): Promise<{ writable: boolean; reason?: string }> {
  const me = await api.get('/api/auth/me').catch(() => null)
  const data = me?.data as { required?: boolean; user?: { agent?: boolean } | null } | null | undefined
  const authRequired = typeof data?.required === 'boolean' ? data.required : null
  return writeAccess({ baseUrl, authRequired, agent: Boolean(token) && data?.user?.agent === true })
}

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'lib')
const registry = createRegistry(await loadTools(libDir))

const server = new Server({ name: 'docdd-console', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: registry.tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema as { type: 'object' } }))
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = registry.find(request.params.name)
  // Спрашиваем на каждый вызов записи: токен истекает, а вход могут выключить.
  const { writable, reason } = tool?.access === 'write' ? await access() : { writable: false, reason: undefined }
  const outcome = await callTool(registry, request.params.name, request.params.arguments ?? {}, { api, projectId }, { writable, reason, secret: token })
  return { content: [{ type: 'text', text: outcome.text }], isError: outcome.isError }
})

await server.connect(new StdioServerTransport())
