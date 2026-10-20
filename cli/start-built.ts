import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exit, execPath, stderr, env } from 'node:process';

/**
 * Запуск собранной версии для ежедневной работы (R-0052). Сборку сам не
 * делает: она долгая, и молча её запускать нельзя — честно говорим, что делать.
 * Адрес фиксируем на 127.0.0.1: приложение не должно смотреть наружу.
 */
const entry = resolve('.output', 'server', 'index.mjs');

if (!existsSync(entry)) {
  stderr.write('Сборки нет. Сначала выполните: npm run build\n');
  exit(1);
}

const child = spawn(execPath, [entry], {
  stdio: 'inherit',
  env: { ...env, NITRO_HOST: '127.0.0.1', NITRO_PORT: env.NITRO_PORT ?? '3000' },
});
child.on('exit', (code) => exit(code ?? 0));
