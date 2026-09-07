import { describe, expect, it } from 'vitest';

import { toggleSharedTag } from '../server/lib/manifest-write';

/**
 * Точечная правка sources.shared в манифесте (server/lib/manifest-write.ts).
 * Строка-в-строку, а не через разбор YAML в объект и обратно — остальной
 * текст файла обязан остаться байт в байт тем же.
 */

const LF = String.fromCharCode(10);

function manifest(lines: string[]): string {
  return lines.join(LF) + LF;
}

describe('toggleSharedTag', () => {
  it('добавляет тег, когда tags ещё нет вовсе', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      'roles:',
      '  - id: architect'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'vue', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe(manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue]',
      'roles:',
      '  - id: architect'
    ]));
  });

  it('добавляет тег к уже непустому списку, в конец', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue, typescript]'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'backend', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toContain('tags: [vue, typescript, backend]');
  });

  it('не дублирует тег, который уже включён — тождественная правка не трогает файл', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue]'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'vue', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe(before);
  });

  it('выключает тег из середины списка, не трогая соседние', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue, typescript, backend]'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'typescript', false);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toContain('tags: [vue, backend]');
  });

  it('выключает последний тег — остаётся пустой список, не пропадает строка целиком', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue]'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'vue', false);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toContain('tags: []');
  });

  it('выключение тега, которого и так нет, — тоже тождественная правка', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue]'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'kotlin', false);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe(before);
  });

  it('несколько источников — правит только тот, чей путь назван', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/a',
      '      tags: [vue]',
      '    - path: D:/work/b'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/b', 'kotlin', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe(manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/a',
      '      tags: [vue]',
      '    - path: D:/work/b',
      '      tags: [kotlin]'
    ]));
  });

  it('источника с таким путём нет — отказ, текст не тронут', () => {
    const before = manifest(['sources:', '  shared:', '    - path: D:/work/a']);
    const outcome = toggleSharedTag(before, 'D:/work/не-такой', 'vue', true);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('не найден');
  });

  it('путь в кавычках — тоже находится и сравнивается без них', () => {
    const before = manifest(['sources:', '  shared:', "    - path: 'D:/work/docdd-console'"]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'vue', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toContain('tags: [vue]');
  });

  it('tags блочным списком — не свой формат, отказ, а не порча файла', () => {
    const before = manifest([
      'sources:',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags:',
      '        - vue'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'typescript', true);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('tags');
  });

  it('остальной текст файла не трогает — комментарии и соседние ключи целы', () => {
    const before = manifest([
      'contract: docdd.workspace/1',
      'sources:',
      '  # свой комментарий',
      '  code: [app]',
      '  shared:',
      '    - path: D:/work/docdd-console',
      '      tags: [vue]',
      'policy:',
      '  map_portion_files: 40'
    ]);
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'typescript', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toContain('# свой комментарий');
    expect(outcome.text).toContain('code: [app]');
    expect(outcome.text).toContain('map_portion_files: 40');
  });

  it('сохраняет CRLF, если файл был в CRLF', () => {
    const before = ['sources:', '  shared:', '    - path: D:/work/docdd-console'].join('\r\n') + '\r\n';
    const outcome = toggleSharedTag(before, 'D:/work/docdd-console', 'vue', true);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toContain('\r\n      tags: [vue]\r\n');
  });
});
