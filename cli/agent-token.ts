// Токен агента для MCP (R-0107): запускается на машине консоли, из её рабочего каталога.
// Использование: tsx cli/agent-token.ts <логин агента> [--data <папка>]
// Читает .data напрямую, как cli/add-user.ts: хранилище Nitro вне сервера недоступно.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { argv, exit, stderr, stdout } from 'node:process'

import { AGENT_TOKEN_TTL_MS, sessionVersionOf, signAgentToken, type UserAccount } from '../server/lib/auth'

const dataFlag = argv.indexOf('--data')
const dir = resolve(dataFlag >= 0 ? argv[dataFlag + 1] ?? '.data' : '.data')
const login = argv[2] ?? ''
const text = (name: string): string | null => {
  const file = join(dir, name)
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null
}
const account = (JSON.parse(text('users.json') ?? '[]') as UserAccount[]).find((user) => user.login === login && user.agent)
if (!account) {
  stderr.write(`Аккаунта агента \`${login}\` нет в ${dir}: заведите его через POST /api/auth/users с полем agent.\n`)
  exit(2)
}
// Хранилище кладёт строку как есть, без кавычек JSON.
const secret = text('session-secret.json')
if (!secret) {
  stderr.write(`Секрета сессий нет в ${dir}: консоль со входом ещё не запускалась.\n`)
  exit(2)
}
stdout.write(signAgentToken(account.login, Date.now() + AGENT_TOKEN_TTL_MS, secret, sessionVersionOf(account)) + '\n')
