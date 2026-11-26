import { createHash } from 'node:crypto';

import { hasRanks } from '../work-order';
import { loadIndex } from '../../utils/index-service';
import { priorityInput } from '../../utils/priority-service';

function fingerprint(root: string) {
  const tasks = loadIndex(root).records.filter((item) => item.type === 'task')
    .map(({ id, title, status, phase, version }) => [id, title, status, phase, version]);
  return createHash('sha256').update(JSON.stringify([priorityInput(root), tasks])).digest('hex');
}

const key = (root: string) => 'priority-revision:' + createHash('sha256').update(root).digest('hex');
const storage = async () => (await import('nitropack/runtime')).useStorage('data');

export async function priorityState(root: string) {
  const current = fingerprint(root);
  const saved = await (await storage()).getItem<string>(key(root));
  return { revision: current, state: saved === current ? 'current' : hasRanks(loadIndex(root).records) ? 'stale' : 'missing' };
}

export async function rememberPriority(root: string) {
  await (await storage()).setItem(key(root), fingerprint(root));
}
