// MCP-сервер консоли (R-0107, A-0002). stdout занят протоколом: сообщения — только в stderr.
// Окружение: DOCDD_PROJECT (обязательно), DOCDD_URL, DOCDD_AGENT_TOKEN. Подключение: docs/17-mcp.md.
import { dirname, join } from 'node:path'
import { env, exit, stderr } from 'node:process'
import { fileURLToPath } from 'node:url'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

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
 * Запись — только когда консоль подтвердила вход и признала токен токеном агента.
 * Без входа API не отличает агента от человека, и инструмент смог бы подтвердить запись.
 */
async function isWritable(): Promise<boolean> {
  if (!token) return false
  const me = await api.get('/api/auth/me').catch(() => null)
  const data = me?.data as { required?: boolean; user?: { agent?: boolean } | null } | null | undefined
  return data?.required === true && data.user?.agent === true
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
  const writable = tool?.access === 'write' ? await isWritable() : false
  const outcome = await callTool(registry, request.params.name, request.params.arguments ?? {}, { api, projectId }, { writable, secret: token })
  return { content: [{ type: 'text', text: outcome.text }], isError: outcome.isError }
})

await server.connect(new StdioServerTransport())
