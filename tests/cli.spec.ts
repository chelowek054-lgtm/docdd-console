import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { exitCode, formatJson, formatText, summarize } from '../cli/report';
import { buildIndex } from '../server/lib/indexer';
import type { ProjectIndex } from '../server/lib/types';

/**
 * Проверка из командной строки — вторая точка входа в то же ядро. Считать она
 * обязана ровно то же, что экран: расхождение здесь означало бы, что сборка и
 * человек видят разные проекты.
 */

const fixture = fileURLToPath(new URL('./fixtures/example-project/', import.meta.url)).replace(/[\\/]$/, '');
const cli = fileURLToPath(new URL('../cli/check.ts', import.meta.url));
const { index } = buildIndex(fixture, new Date('2026-08-30T12:00:00Z'));

function withIssues(issues: ProjectIndex['issues']): ProjectIndex {
  return { ...index, issues };
}

describe('exitCode', () => {
  it('единица, когда есть хотя бы одна ошибка', () => {
    expect(exitCode(index)).toBe(1);
  });

  it('ноль, когда остались только предупреждения: правило и мнение — разное', () => {
    const onlyWarnings = withIssues(index.issues.filter((issue) => issue.severity === 'warning'));
    expect(summarize(onlyWarnings).warnings).toBeGreaterThan(0);
    expect(exitCode(onlyWarnings)).toBe(0);
  });

  it('ноль на проекте без нарушений', () => {
    expect(exitCode(withIssues([]))).toBe(0);
  });
});

describe('formatText', () => {
  it('ошибки идут раньше предупреждений', () => {
    const text = formatText(index);
    expect(text.indexOf('ОШИБКА')).toBeLessThan(text.indexOf('внимание'));
  });

  it('каждое нарушение несёт код, путь и объяснение', () => {
    const text = formatText(index);
    expect(text).toContain('parse_failed');
    expect(text).toContain('docs/development/design/D-9998-broken.md');
    expect(text).toContain('Первая строка должна быть');
  });

  it('на чистом проекте говорит прямо, а не молчит', () => {
    expect(formatText(withIssues([]))).toContain('Нарушений нет');
  });
});

describe('formatJson', () => {
  it('разбирается программой и несёт счётчики', () => {
    const parsed = JSON.parse(formatJson(index)) as { errors: number; warnings: number; issues: unknown[] };
    expect(parsed.errors).toBe(summarize(index).errors);
    expect(parsed.warnings).toBe(summarize(index).warnings);
    expect(parsed.issues).toHaveLength(index.issues.length);
  });
});

/**
 * Запуск настоящей командой: коды возврата — то, ради чего фаза и делалась,
 * и проверять их пересказом нельзя.
 */
describe('docdd check как команда', () => {
  function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync('npx', ['tsx', cli, ...args], { encoding: 'utf8', shell: true, stdio: 'pipe' });
      return { code: 0, stdout, stderr: '' };
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      return { code: failure.status ?? -1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
    }
  }

  it('на проекте с ошибками возвращает 1', () => {
    const result = runCli([fixture]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('ОШИБКА');
  }, 60_000);

  it('на несуществующем проекте возвращает 2, а не 1', () => {
    const result = runCli([join(fixture, 'app')]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('project.yaml');
  }, 60_000);

  it('без пути возвращает 2 и объясняет, как звать', () => {
    const result = runCli([]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('Не указан путь');
  }, 60_000);

  it('--help ничего не проверяет и возвращает 0', () => {
    const result = runCli(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Коды возврата');
  }, 60_000);

  it('не пишет кэш: чужой репозиторий остаётся нетронутым', () => {
    const cache = join(fixture, '.docdd');
    rmSync(cache, { recursive: true, force: true });
    runCli([fixture]);
    expect(existsSync(cache)).toBe(false);
  }, 60_000);
});
