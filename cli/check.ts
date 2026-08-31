import { argv, exit, stderr, stdout } from 'node:process';

import { buildIndex } from '../server/lib/indexer';
import { WorkspaceError } from '../server/lib/workspace';
import { exitCode, formatJson, formatText } from './report';

/**
 * `docdd check <путь>` — вторая точка входа в то же ядро (docs/06-phases.md,
 * фаза 6). Ничего не пишет: ни файлов, ни кэша — проверка в чужом конвейере не
 * должна оставлять следов в чужом репозитории.
 */

const HELP = [
  'docdd check — проверка проекта по контракту docdd.workspace/1',
  '',
  '  npm run check -- <путь к проекту> [--json]',
  '',
  '  <путь>   папка проекта, внутри которой лежит docs/development/project.yaml',
  '  --json   вывод для сборки вместо вывода для человека',
  '',
  'Коды возврата:',
  '  0  ошибок нет (предупреждения на код возврата не влияют)',
  '  1  есть хотя бы одна ошибка',
  '  2  проект не прочитан: нет манифеста, чужое поколение контракта, неверный вызов',
  ''
].join('\n');

export function run(args: readonly string[]): number {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(HELP);
    return 0;
  }

  const json = args.includes('--json');
  const paths = args.filter((arg) => arg !== '' && !arg.startsWith('-'));

  if (paths.length === 0) {
    stderr.write(`Не указан путь к проекту.\n\n${HELP}`);
    return 2;
  }
  if (paths.length > 1) {
    stderr.write(`Проверяется один проект за раз, а указано ${paths.length}.\n`);
    return 2;
  }

  try {
    // buildIndex, а не loadIndex: кэш здесь не читается и не пишется.
    const { index } = buildIndex(paths[0] as string);
    stdout.write(`${json ? formatJson(index) : formatText(index)}\n`);
    return exitCode(index);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      // «Не прочитали проект» — это не «нашли нарушение»: в сборке эти два
      // случая требуют разных действий, и код возврата обязан их различать.
      stderr.write(`${error.message}\n`);
      if (error.detail) stderr.write(`${error.detail}\n`);
      return 2;
    }
    stderr.write(`Проверка не выполнена: ${String(error)}\n`);
    return 2;
  }
}

// Побочное действие — только при запуске как команды: импорт из теста ничего
// выполнять не должен.
const entry = (argv[1] ?? '').replace(/\\/g, '/');
if (entry.endsWith('/cli/check.ts') || entry.endsWith('/cli/check.js')) {
  exit(run(argv.slice(2)));
}
