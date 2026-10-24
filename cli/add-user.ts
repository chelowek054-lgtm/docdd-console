// Первый администратор для общего сервера (docs/adr/0020): пишет .data/users.json
// напрямую, потому что до первой учётки войти в API нечем.
// Использование: tsx cli/add-user.ts <логин> <пароль> [--name "Имя"] [--admin] [--data <папка>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { argv, exit, stderr, stdout } from 'node:process'

import { hashPassword, type UserAccount } from '../server/lib/auth'

function option(name: string): string | undefined {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}

const args = argv.slice(2).filter((item, at, all) => !item.startsWith('--') && !(at > 0 && all[at - 1]!.startsWith('--') && all[at - 1] !== '--admin'))
const [login, password] = args
if (!login || !password || !/^[a-z0-9._-]{2,40}$/i.test(login) || password.length < 8) {
  stderr.write('Использование: tsx cli/add-user.ts <логин> <пароль от 8 символов> [--name "Имя"] [--admin] [--data <папка>]\n')
  exit(2)
}
const dir = resolve(option('--data') ?? '.data')
const file = join(dir, 'users.json')
const users: UserAccount[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
const entry: UserAccount = { login, name: option('--name') ?? login, passwordHash: hashPassword(password), admin: argv.includes('--admin') }
const at = users.findIndex((user) => user.login === login)
if (at === -1) users.push(entry)
else users[at] = entry
mkdirSync(dir, { recursive: true })
writeFileSync(file, JSON.stringify(users, null, 2))
stdout.write(`${entry.admin ? 'Администратор' : 'Пользователь'} ${login} записан в ${file}\n`)
