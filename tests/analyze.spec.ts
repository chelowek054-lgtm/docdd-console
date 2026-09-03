import { describe, expect, it } from 'vitest';

import { analyze, type SourceFile } from '../server/lib/analyze';

/**
 * `docs/development` не обязан хранить только записи — README, вендоренная
 * копия документации формата и подобное лежат рядом на законных основаниях.
 * Разбор не должен принимать это за сломанные записи (docs/05-validation.md).
 */

const manifest = {
  contract: 'docdd.workspace/1',
  project: { id: 'demo', name: 'Demo' },
  paths: { tasks: 'tasks' }
};

function file(path: string, text: string): SourceFile {
  return { text, source: { path } };
}

describe('файлы без front matter', () => {
  it('README рядом с записями не даёт нарушения', () => {
    const readme = file('docs/development/README.md', '# docs/development\n\nРабочая папка процесса.\n');
    const result = analyze({ files: [readme], manifest });
    expect(result.violations).toEqual([]);
    expect(result.records).toEqual([]);
  });

  it('вендоренная копия документации формата — туда же', () => {
    const vendored = file(
      'docs/development/_contract/SPEC.md',
      '# Контракт файлов процесса\n\nФормат, который читает и пишет приложение.\n'
    );
    const result = analyze({ files: [vendored], manifest });
    expect(result.violations).toEqual([]);
  });

  it('а по-настоящему сломанная запись — по-прежнему нарушение', () => {
    const broken = file(
      'docs/development/tasks/T-0001-slomana.md',
      '---\nid: T-0001\ntype: task\ntitle: Без обязательных полей\n---\n\nТекст.\n'
    );
    const result = analyze({ files: [broken], manifest });
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
