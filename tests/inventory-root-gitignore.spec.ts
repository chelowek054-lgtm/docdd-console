import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readWorkspace } from '../server/lib/workspace';

/**
 * Обход кода начинается с `sources.code` (`src`), но `.gitignore` корня
 * проекта действует и там — как у настоящего git (docs/07-maps.md):
 * `__pycache__/` из корня не попадает в опись.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-root-ignore-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  mkdirSync(join(root, 'src', 'pkg', '__pycache__'), { recursive: true });
  mkdirSync(join(root, 'tools', 'sub', 'gen'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1',
    'project:',
    '  id: demo',
    '  name: Demo',
    'paths:',
    '  design: design',
    'sources:',
    '  code: [src, tools/sub]',
    ''
  ].join('\n'), 'utf8');
  writeFileSync(join(root, '.gitignore'), '__pycache__/\n*.pyc\n', 'utf8');
  writeFileSync(join(root, 'tools', '.gitignore'), 'gen/\n', 'utf8');
  writeFileSync(join(root, 'src', 'pkg', 'mod.py'), 'x = 1\n', 'utf8');
  writeFileSync(join(root, 'src', 'pkg', '__pycache__', 'mod.cpython-312.pyc'), 'bytecode', 'utf8');
  writeFileSync(join(root, 'src', 'pkg', 'stray.pyc'), 'bytecode', 'utf8');
  writeFileSync(join(root, 'tools', 'sub', 'run.py'), 'y = 2\n', 'utf8');
  writeFileSync(join(root, 'tools', 'sub', 'gen', 'out.py'), 'z = 3\n', 'utf8');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('опись кода и .gitignore над корнем кода', () => {
  it('правила корня проекта действуют в src', () => {
    const files = readWorkspace(root).codeFiles;
    expect(files).toContain('src/pkg/mod.py');
    expect(files.some((file) => file.includes('__pycache__'))).toBe(false);
    expect(files).not.toContain('src/pkg/stray.pyc');
  });

  it('правила промежуточной папки действуют в корне кода под ней', () => {
    const files = readWorkspace(root).codeFiles;
    expect(files).toContain('tools/sub/run.py');
    expect(files).not.toContain('tools/sub/gen/out.py');
  });
});
