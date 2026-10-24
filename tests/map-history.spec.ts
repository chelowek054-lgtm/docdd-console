// Записи карт: живые карты и смены курса (R-0095, docs/04-ui.md).
import { describe, expect, it } from 'vitest';

import { partitionMapRecords, type CourseEntry } from '../server/lib/course';

const entry = (map: string): CourseEntry => ({ map, title: map, at: '2026-10-01', by: 'architect', added: 1, removed: 0, statusChanged: 0, relations: 0, vision: false });

describe('записи карт: род по содержанию', () => {
  it('запись из истории курса — смена курса, остальные — живые карты', () => {
    const records = [{ id: 'M-0001' }, { id: 'M-0002' }, { id: 'M-0003' }];
    const { live, course } = partitionMapRecords(records, [entry('M-0002')]);
    expect(live.map((r) => r.id)).toEqual(['M-0001', 'M-0003']);
    expect(course.map((r) => r.id)).toEqual(['M-0002']);
  });
  it('истории нет — все карты живые', () => {
    expect(partitionMapRecords([{ id: 'M-0001' }], []).course).toEqual([]);
  });
});
