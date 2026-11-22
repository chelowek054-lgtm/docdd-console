/**
 * Может ли MCP писать (A-0008, п. 6; R-0134). Со входом — только токен агента: иначе API не отличит
 * агента от человека. Без входа — только когда консоль на этой же машине: на общем сервере без входа
 * писать мог бы кто угодно, а на localhost и так пишет только хозяин машины.
 */
export interface WriteAccessInput {
  baseUrl: string;
  /** `required` из `/api/auth/me`; `null` — консоль не ответила. */
  authRequired: boolean | null;
  /** Консоль признала токен токеном агента. */
  agent: boolean;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function writeAccess(input: WriteAccessInput): { writable: boolean; reason?: string } {
  if (input.authRequired === null) return { writable: false, reason: 'Консоль не ответила на /api/auth/me: запись выключена' };
  if (input.authRequired) {
    return input.agent ? { writable: true } : { writable: false, reason: 'Со входом пишет только агент: задайте DOCDD_AGENT_TOKEN (docs/17-mcp.md)' };
  }
  let host = '';
  try {
    host = new URL(input.baseUrl).hostname.toLowerCase();
  } catch {
    return { writable: false, reason: `Адрес консоли ${input.baseUrl} не разбирается` };
  }
  return LOOPBACK.has(host)
    ? { writable: true }
    : { writable: false, reason: 'Запись без входа — только на localhost: на общем сервере включите вход и задайте токен агента' };
}
