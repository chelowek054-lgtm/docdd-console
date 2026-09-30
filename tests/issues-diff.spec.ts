import { describe, expect, it } from 'vitest';

import { newIssues } from '../server/lib/issues-diff';
import type { IssueDto } from '../server/lib/types';

const issue = (code: string, recordId: string | null, message = 'м'): IssueDto => ({
  severity: 'error', code: code as IssueDto['code'], recordId, path: 'p.md', message
});

describe('newIssues', () => {
  it('возвращает только то, чего раньше не было', () => {
    const before = [issue('link_broken', 'T-1')];
    const after = [issue('link_broken', 'T-1'), issue('task_no_requirement', 'T-2')];
    expect(newIssues(before, after).map((item) => item.recordId)).toEqual(['T-2']);
  });

  it('то же нарушение с другим объяснением — новое, исправленное — не возвращается', () => {
    expect(newIssues([issue('link_broken', 'T-1', 'а')], [issue('link_broken', 'T-1', 'б')])).toHaveLength(1);
    expect(newIssues([issue('link_broken', 'T-1')], [])).toEqual([]);
  });
});
