// V-0052 manual — подготовка (автоматная часть: поведение без сборки и описание команды)
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('R-0052 запуск собранной версии', () => {
  it('без .output: сообщение «Сборки нет…» и код 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nobuild-'));
    const tsx = resolve('node_modules/tsx/dist/cli.mjs');
    const run = spawnSync(process.execPath, [tsx, resolve('cli/start-built.ts')], { cwd: dir, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('Сборки нет');
    expect(run.stderr).toContain('npm run build');
  });
  it('команда в package.json, описана в README и docs/08-usage.md', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['start:built']).toContain('cli/start-built.ts');
    expect(readFileSync('README.md', 'utf8')).toContain('npm run start:built');
    expect(readFileSync('docs/08-usage.md', 'utf8')).toContain('npm run start:built');
  });
});
