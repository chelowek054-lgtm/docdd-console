import { expect, it } from 'vitest';
import { codebaseWarnings } from '../server/lib/codebase';

it('warns about missing purpose and a thirty-file module, respecting thresholds', () => {
  const files = new Set(['src/orders/index.ts', ...Array.from({ length: 29 }, (_, i) => `src/orders/file${i}.ts`)]);
  const modules = [{ id: 'orders', path: 'src/orders' }];
  expect(codebaseWarnings(modules, files).map((item) => item.code))
    .toEqual(expect.arrayContaining(['module_purpose_missing', 'module_too_large']));
  expect(codebaseWarnings([{ ...modules[0]!, summary: 'Orders' }], files, { moduleFiles: 30, folderEntries: 30 }))
    .toEqual([]);
});
