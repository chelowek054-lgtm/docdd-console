// Подставная программа вместо Claude Code: ведёт себя так же — требует текст
// либо аргументом, либо на стандартном вводе. Нужна, чтобы проверить сам
// запуск, не тратя настоящий вызов.
const args = process.argv.slice(2);
const at = args.indexOf('-p');
const fromArgument = at !== -1 && args[at + 1] ? args[at + 1] : '';

if (fromArgument) {
  process.stdout.write(`получено аргументом: ${fromArgument}`);
  process.exit(0);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  if (!input.trim()) {
    process.stderr.write('Error: Input must be provided either through stdin or as a prompt argument when using --print');
    process.exit(1);
  }
  process.stdout.write(`получено вводом: ${input.trim()}`);
});
