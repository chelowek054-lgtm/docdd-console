import { describe, expect, it } from 'vitest';

import { dropCache, onCacheDropped } from '../server/lib/cache';
import { normalizeRoot } from '../server/lib/paths';

/** Любая запись в проект зовёт `dropCache`; на него подписаны кэши в памяти (чтение папки, отпечатки). */
describe('dropCache', () => {
  it('сообщает подписчикам корень, в котором что-то записали', () => {
    const seen: string[] = [];
    onCacheDropped((root) => seen.push(root));
    dropCache('D:/work/nowhere-project');
    expect(seen).toEqual([normalizeRoot('D:/work/nowhere-project')]);
  });
});
