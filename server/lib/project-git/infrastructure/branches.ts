import { relative } from 'node:path';

import { git } from '../../../utils/git';
import { BRANCH_PREFIX, recordOfBranch } from '../../branch';
import { normalizeRoot, resolveInside, toProjectPath } from '../../paths';

const HEADS = 'refs/heads/';
const MAIN = 'main';

export type ProjectGit = { repository: false } | {
  repository: true;
  current: string | null;
  main: boolean;
  branches: { name: string; taskId: string | null; merged: boolean | null }[];
};

export async function readProjectGit(root: string): Promise<ProjectGit> {
  const projectRoot = normalizeRoot(root);
  resolveInside(projectRoot, '.git');
  const top = await git(projectRoot, ['rev-parse', '--show-toplevel']);
  if (!top.ok || relative(projectRoot, normalizeRoot(top.stdout.replace(/\r?\n$/, ''))) !== '') {
    return { repository: false };
  }

  // Worktree pointers can put HEAD and shared refs in different directories.
  const metadata = await Promise.all([
    git(projectRoot, ['rev-parse', '--absolute-git-dir']),
    git(projectRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  ]);
  for (const location of metadata) {
    if (!location.ok) throw new Error('Git metadata is unavailable');
    const path = location.stdout.replace(/\r?\n$/, '');
    resolveInside(projectRoot, toProjectPath(projectRoot, path));
  }

  const [head, refs] = await Promise.all([
    git(projectRoot, ['symbolic-ref', '--quiet', 'HEAD']),
    git(projectRoot, ['for-each-ref', '--format=%(refname:lstrip=2)%09%(objectname)', HEADS])
  ]);
  if (!refs.ok || (!head.ok && head.code !== 1)) throw new Error('Git branches are unavailable');
  const fullHead = head.stdout.trimEnd();
  const current = fullHead.startsWith(HEADS) ? fullHead.slice(HEADS.length) : null;
  const branches = refs.stdout.trimEnd().split(/\r?\n/).filter(Boolean).map((line) => {
    const [name = '', oid] = line.split('\t');
    return { name, oid };
  });
  const main = branches.find(({ name }) => name === MAIN)?.oid;
  let merged: Set<string> | null = null;
  if (main) {
    // Pin the comparison to the observed main commit in case a ref moves during the read.
    const result = await git(projectRoot, ['for-each-ref', `--merged=${main}`, '--format=%(objectname)', HEADS]);
    if (!result.ok) throw new Error('Git merge status is unavailable');
    merged = new Set(result.stdout.trimEnd().split(/\r?\n/));
  }

  return {
    repository: true,
    current,
    main: Boolean(main),
    branches: branches.map(({ name, oid }) => {
      const record = recordOfBranch(name);
      const taskId = record?.startsWith('T-') && name.startsWith(`${BRANCH_PREFIX}/${record}-`) ? record : null;
      return { name, taskId, merged: merged && oid ? merged.has(oid) : null };
    })
  };
}
