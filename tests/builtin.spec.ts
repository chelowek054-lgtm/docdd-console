import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUILTIN_SOURCE, withBuiltin } from '../server/lib/builtin';
import { ensureBuiltinEntry, toggleSharedTag } from '../server/lib/manifest-write';
import { sharedRecordsOf } from '../server/lib/shared';
import { analyze } from '../server/lib/analyze';
import { readWorkspace } from '../server/lib/workspace';

/** Встроенный набор практик (docs/11-shared-sources.md, ADR-0015). */

describe('источники с встроенным набором', () => {
  it('записи нет — неявный builtin с тегом general, первым', () => {
    expect(withBuiltin([{ path: 'D:/x', tags: ['vue'] }])).toEqual([
      { path: BUILTIN_SOURCE, tags: ['general'] },
      { path: 'D:/x', tags: ['vue'] }
    ]);
    expect(withBuiltin([])).toEqual([{ path: 'builtin', tags: ['general'] }]);
  });

  it('своя запись берётся как есть и переезжает наверх; пустые теги отключают', () => {
    const result = withBuiltin([{ path: 'D:/x' }, { path: 'builtin', tags: [] }]);
    expect(result[0]).toEqual({ path: 'builtin', tags: [] });
    expect(result).toHaveLength(2);
  });
});

describe('запись builtin в манифест', () => {
  it('нет секции sources — дописывается в конец', () => {
    const out = ensureBuiltinEntry('contract: docdd.workspace/1\nroles: []\n');
    expect(out).toContain('sources:\n  shared:\n    - path: builtin\n      tags: [general]');
  });

  it('есть sources без shared — shared вставляется сразу под ней, остальное не тронуто', () => {
    const text = 'sources:\n  # комментарий человека\n  code: [src]\nroles: []\n';
    const out = ensureBuiltinEntry(text);
    expect(out).toContain('sources:\n  shared:\n    - path: builtin\n      tags: [general]\n  # комментарий человека\n  code: [src]');
  });

  it('есть shared со своими источниками — builtin встаёт первым', () => {
    const out = ensureBuiltinEntry('sources:\n  shared:\n    - path: D:/x\n      tags: [vue]\n');
    expect(out).toContain('  shared:\n    - path: builtin\n      tags: [general]\n    - path: D:/x');
  });

  it('shared: [] превращается в блок; запись уже есть — файл не меняется; CRLF сохраняется', () => {
    expect(ensureBuiltinEntry('sources:\n  shared: []\n')).toContain('  shared:\n    - path: builtin');
    const has = 'sources:\n  shared:\n    - path: builtin\n      tags: [python]\n';
    expect(ensureBuiltinEntry(has)).toBe(has);
    expect(ensureBuiltinEntry('sources:\r\n  code: [a]\r\n')).toContain('\r\n    - path: builtin\r\n');
  });

  it('первая галочка: запись внесена, затем тег добавлен', () => {
    const prepared = ensureBuiltinEntry('sources:\n  code: [a]\n');
    const outcome = toggleSharedTag(prepared, 'builtin', 'python', true);
    expect(outcome.ok && outcome.text).toContain('tags: [general, python]');
  });
});

describe('каталог practices/ — обычный DocDD-проект', () => {
  const root = join(fileURLToPath(new URL('..', import.meta.url)), 'practices');

  it('читается как проект, без ошибок разбора, и несёт подтверждённые практики', () => {
    const workspace = readWorkspace(root);
    expect(workspace.manifest.project.id).toBe('docdd');
    const { records, violations } = analyze({ files: workspace.files, manifest: workspace.manifest });
    expect(violations.filter((item) => item.level === 'error')).toEqual([]);
    expect(records.filter((record) => record.type === 'decision').length).toBeGreaterThan(5);
  });

  it('общие принципы кода подключаются тегом general сразу', () => {
    const workspace = readWorkspace(root);
    const { records } = analyze({ files: workspace.files, manifest: workspace.manifest });
    const index = records.map((record) => ({
      id: record.id, type: record.type, title: record.title, status: record.status,
      tags: Array.isArray(record.data['tags']) ? (record.data['tags'] as string[]) : []
    }));
    const connected = sharedRecordsOf(index as never, ['general']);
    expect(connected.length).toBeGreaterThan(0);
    expect(connected.every((item) => item.status === 'approved')).toBe(true);
  });
});
