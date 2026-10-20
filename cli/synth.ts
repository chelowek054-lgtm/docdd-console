// Синтетический проект и замер (T-0046): tsx cli/synth.ts <папка> [--n 5000] [--keep]
// Создаёт проект из N записей, замеряет сборку индекса холодную и повторную.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv } from 'node:process';

import { buildIndex } from '../server/lib/indexer';
import { DEFAULT_PATHS, manifestYaml, recordTemplate } from '../server/lib/scaffold';

export function generate(root: string, count: number): void {
  const development = join(root, 'docs', 'development');
  rmSync(root, { recursive: true, force: true });
  for (const folder of Object.values(DEFAULT_PATHS)) mkdirSync(join(development, folder), { recursive: true });
  writeFileSync(join(development, 'project.yaml'), manifestYaml({ id: 'synth', name: 'Синтетический' }), 'utf8');
  const today = '2026-10-20';
  const pad = (n: number) => String(n).padStart(4, '0');
  // Пропорция: пять записей на цепочку «требование, проверка, три задачи» — как в живых проектах.
  const chains = Math.floor(count / 5);
  for (let i = 1; i <= chains; i++) {
    const r = `R-${pad(i)}`;
    const v = `V-${pad(i)}`;
    const put = (folder: string, id: string, text: string) => writeFileSync(join(development, folder, `${id}-synt.md`), text, 'utf8');
    put('requirements', r, recordTemplate({ id: r, type: 'requirement', title: `Требование ${i}`, today, links: { verified_by: [v] } }));
    put('tests', v, recordTemplate({ id: v, type: 'verification', title: `Проверка ${i}`, today, links: { verifies: [r] } }));
    for (let k = 0; k < 3; k++) {
      const t = `T-${pad((i - 1) * 3 + k + 1)}`;
      put('tasks', t, recordTemplate({ id: t, type: 'task', title: `Задача ${t}`, today, change: 'fix', reuse: 'none', links: { implements: [r] } }));
    }
  }
}

if (process.argv[1] && /synth\.ts$/.test(process.argv[1])) {
  const args = argv.slice(2);
  const target = resolve(args.find((a) => !a.startsWith('--') && a !== args[args.indexOf('--n') + 1]) ?? '.synth');
  const n = Number(args[args.indexOf('--n') + 1]) || 5000;
  generate(target, n);
  for (const label of ['холодная', 'повторная']) {
    const t0 = performance.now();
    const { index } = buildIndex(target);
    console.log(`${label} сборка индекса: ${Math.round(performance.now() - t0)} мс, записей ${index.records.length}, нарушений ${index.issues.length}`);
  }
  if (!args.includes('--keep')) rmSync(target, { recursive: true, force: true });
}
