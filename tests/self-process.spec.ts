import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyze } from '../server/lib/analyze';
import { readWorkspace } from '../server/lib/workspace';

/**
 * Самопроверка процесса (T-0006): консоль прогоняет собственную проверку над
 * своим docs/development. Падает на ошибке процесса, а не на предупреждении:
 * предупреждения — повод подумать, ошибки — повод остановиться.
 */
const root = fileURLToPath(new URL('..', import.meta.url));

describe('процесс этого репозитория', () => {
  it('docs/development проходит проверку консоли без ошибок', () => {
    const workspace = readWorkspace(root);
    const result = analyze({
      files: workspace.files,
      manifest: workspace.manifest,
      reports: workspace.reports,
      codeFiles: workspace.codeFiles
    });
    const errors = result.violations.filter((violation) => violation.level === 'error');
    expect(errors.map((violation) => `${violation.code} ${violation.id ?? ''} ${violation.path}: ${violation.message}`)).toEqual([]);
  });
});
