// V-0004 (R-0004, T-0009): модель на общем сервере не читает вне корня проекта и не видит секретов.
import { afterEach, describe, expect, it } from 'vitest';

import { ask, SHARED_DENY, sharedJailFailure } from '../server/utils/llm';

describe('sharedJailFailure', () => {
  const inside = (root: string) => root.startsWith('/srv/projects/');
  it('локальный режим и запрос без инструментов не ограничиваются', () => {
    expect(sharedJailFailure({ access: 'read' }, false, inside)).toBeNull();
    expect(sharedJailFailure({ access: 'none' }, true, inside)).toBeNull();
    expect(sharedJailFailure({}, true, inside)).toBeNull();
  });
  it('shared: инструменты без cwd или с cwd вне разрешённых — отказ', () => {
    for (const access of ['read', 'edits', 'full'] as const) {
      expect(sharedJailFailure({ access }, true, inside)?.code).toBe('unauthorized');
      expect(sharedJailFailure({ access, cwd: '/etc' }, true, inside)?.code).toBe('unauthorized');
      expect(sharedJailFailure({ access, cwd: '/srv/projects/a' }, true, inside)).toBeNull();
    }
  });
});

describe('SHARED_DENY', () => {
  it('закрывает .data и .env* для всех инструментов чтения и записи', () => {
    const list = SHARED_DENY.join(' ');
    for (const tool of ['Read', 'Edit', 'Write', 'NotebookEdit', 'Glob', 'Grep']) {
      expect(list).toContain(`${tool}(**/.data/**)`);
      expect(list).toContain(`${tool}(**/.env*)`);
    }
    expect(SHARED_DENY[0]).toBe('--disallowed-tools');
  });
});

describe('ask в shared: аргументы запуска ограничены корнем проекта', () => {
  const saved = process.env.DOCDD_MODE; const savedRoots = process.env.DOCDD_PROJECT_ROOTS;
  afterEach(() => { if (saved === undefined) delete process.env.DOCDD_MODE; else process.env.DOCDD_MODE = saved; if (savedRoots === undefined) delete process.env.DOCDD_PROJECT_ROOTS; else process.env.DOCDD_PROJECT_ROOTS = savedRoots; });

  const capture = async (access: 'read' | 'edits', cwd: string) => {
    let args: readonly string[] = [];
    await ask('прочитай файл вне проекта', { access, cwd, run: async (_cmd: string, a: readonly string[]) => { args = a; return { stdout: 'ok', stderr: '', code: 0 } as never; } } as never);
    return args;
  };

  it('Read разрешён только внутри корня, /etc/passwd в список не входит', async () => {
    process.env.DOCDD_MODE = 'shared';
    process.env.DOCDD_PROJECT_ROOTS = '/srv/projects';
    const args = await capture('read', '/srv/projects/a');
    const text = args.join(' ');
    expect(text).toContain('Read(//srv/projects/a/**)');
    expect(text).not.toMatch(/--allowed-tools [^-]*\bRead\b(?!\()/);
    expect(text).toContain('Read(**/.data/**)');
    expect(text).not.toContain('/etc');
  });
});
