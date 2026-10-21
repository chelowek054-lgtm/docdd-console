// V-0072: предпросмотр починки «было → станет» — разбор плана и разнос нарушений
import { describe, expect, it } from 'vitest';
import { fixDiff, parsePlan } from '../server/lib/fix-diff';

const plan = `| Файл | Что меняем | Во что | Почему так |
|---|---|---|---|
| \`docs/development/design/D-0009.md\` | \`status\` | \`draft\` | нет в контракте |
| docs/development/tasks/T-1.md | status | чинить нельзя | закрыта зря |

Остальное — текст.`;

describe('fixDiff', () => {
  it('разбирает строки таблицы, пропуская шапку и разделитель', () => {
    const rows = parsePlan(plan);
    expect(rows.map((row) => row.file)).toEqual(['docs/development/design/D-0009.md', 'docs/development/tasks/T-1.md']);
    expect(rows[1]?.blocked).toBe(true);
  });

  it('разносит нарушения на «закроется» и «останется»', () => {
    const issues = [
      { code: 'bad_status', path: 'docs/development/design/D-0009.md', recordId: 'D-0009' },
      { code: 'closed_early', path: 'docs/development/tasks/T-1.md', recordId: 'T-1' },
      { code: 'other', path: 'docs/x.md', recordId: null }
    ];
    const diff = fixDiff(issues, plan);
    expect(diff.closes).toEqual(['bad_status:D-0009']);
    expect(diff.stays).toEqual(['closed_early:T-1', 'other:docs/x.md']);
    expect(diff.before[0]?.items).toHaveLength(3);
    expect(diff.after.map((group) => group.id)).toEqual(['закроется', 'останется']);
  });

  it('без таблицы всё остаётся', () => {
    expect(fixDiff([{ code: 'a', path: 'p.md' }], 'текст').stays).toEqual(['a:p.md']);
  });
});
