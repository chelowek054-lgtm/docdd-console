import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readWorkspace } from '../server/lib/workspace';

/**
 * Опись кода не должна включать сборочный мусор, который сам проект назвал
 * не своим кодом в `.gitignore` — иначе «Обновить карты» спрашивала бы о нём
 * каждый заход, и он попадал бы в карту наравне с настоящим кодом
 * (docs/07-maps.md).
 */

const LF = String.fromCharCode(10);
let root = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-workspace-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1',
    'project:',
    '  id: demo',
    '  name: Demo',
    'paths:',
    '  requirements: requirements',
    'sources:',
    '  code: [backend]',
    ''
  ].join(LF), 'utf8');

  mkdirSync(join(root, 'backend', '__pycache__'), { recursive: true });
  mkdirSync(join(root, 'backend', '.git'), { recursive: true });
  writeFileSync(join(root, 'backend', '.gitignore'), ['__pycache__/', '*.pyc', ''].join(LF), 'utf8');
  writeFileSync(join(root, 'backend', 'nutrition.py'), 'def f(): pass' + LF, 'utf8');
  writeFileSync(join(root, 'backend', '__pycache__', 'nutrition.cpython-312.pyc'), 'мусор', 'utf8');
  writeFileSync(join(root, 'backend', 'stray.pyc'), 'тоже мусор', 'utf8');
  writeFileSync(join(root, 'backend', '.git', 'HEAD'), 'ref: refs/heads/master' + LF, 'utf8');
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Прибирать не обязательно.
  }
});

describe('readWorkspace — опись кода мимо `.gitignore`', () => {
  it('видит настоящий код', () => {
    expect(readWorkspace(root).codeFiles).toContain('backend/nutrition.py');
  });

  it('не видит папку и файлы, названные в `.gitignore`', () => {
    const files = readWorkspace(root).codeFiles;
    expect(files).not.toContain('backend/__pycache__/nutrition.cpython-312.pyc');
    expect(files).not.toContain('backend/stray.pyc');
  });

  it('не видит `.git` — даже без единого слова о ней в `.gitignore`', () => {
    expect(readWorkspace(root).codeFiles).not.toContain('backend/.git/HEAD');
  });
});
