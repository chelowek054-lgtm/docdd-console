// V-0044 (R-0044): ручная приёмка с записью, кто принял и проверил. Дополняет manual-accept.spec.ts: пустые и граничные данные.
import { describe, expect, it } from 'vitest';

import { isManualKind, manualReportName, manualReportText, manualRunner, verifiedJournalAction } from '../server/lib/manual-report';
import { latestVerificationDetails } from '../server/lib/reports';
import type { Report } from '../server/lib/types';

const NOW = new Date('2026-10-20T10:00:00.123Z');

describe('R-0044: след приёмки', () => {
  it('runner manual:<роль>, роль обрезается, пустая роль — просто manual', () => {
    expect(manualRunner(' qa ')).toBe('manual:qa');
    expect(manualRunner('   ')).toBe('manual');
  });
  it('отчёт: состояние passed у проверки, checked_by и note', () => {
    const r = JSON.parse(manualReportText('V-0013', 'passed', 'analyst', NOW, { by: 'Анна', note: 'прошла путь' }));
    expect(r).toMatchObject({ runner: 'manual:analyst', checked_by: 'Анна', note: 'прошла путь', failed: 0, total: 1, verifications: { 'V-0013': 'passed' } });
  });
  it('логин вошедшего заменяет подпись роли в runner', () => {
    expect(JSON.parse(manualReportText('V-1', 'passed', 'analyst', NOW, { login: 'ivan' })).runner).toBe('manual:ivan');
  });
  it('имя отчёта содержит время до миллисекунд — две отметки не затирают друг друга', () => {
    const a = manualReportName('V-1', NOW);
    expect(a).toBe('2026-10-20-manual-V-1-100000123.json');
    expect(manualReportName('V-1', new Date(NOW.getTime() + 1))).not.toBe(a);
  });
  it('журнал: роль, проверил Имя, что проверено; без имени строка без «проверил»', () => {
    expect(verifiedJournalAction(true, 'analyst', { by: 'Анна', note: 'ок' })).toBe('проверена вручную · analyst · проверил Анна · ок');
    expect(verifiedJournalAction(true, 'analyst', { note: 'ок' })).toBe('проверена вручную · analyst · ок');
  });
  it('заметка ровно 120 знаков не обрезается, 121 — обрезается', () => {
    const tail = (n: number) => (verifiedJournalAction(true, 'a', { by: 'И', note: 'я'.repeat(n) }).split(' · ')[3] ?? '');
    expect(tail(120)).toHaveLength(120);
    expect(tail(121).endsWith('…')).toBe(true);
    expect(tail(121)).toHaveLength(120);
  });
  it('manual и review — ручные виды; unit, integration, metric, пусто и не-строка — нет', () => {
    expect(['manual', 'review'].every(isManualKind)).toBe(true);
    for (const k of ['unit', 'integration', 'metric', '', undefined, 5]) expect(isManualKind(k)).toBe(false);
  });
  it('на экране видно кто принял: runner, checkedBy, note, время', () => {
    const reports: Report[] = [{ contract: 'docdd.workspace/1', runner: 'manual:analyst', started_at: '2026-10-20T10:00:00.000Z', checked_by: 'Анна', note: 'прошла', verifications: { 'V-1': 'passed' } }];
    expect(latestVerificationDetails(reports).get('V-1')).toEqual({ state: 'passed', at: '2026-10-20T10:00:00.000Z', runner: 'manual:analyst', checkedBy: 'Анна', note: 'прошла' });
  });
});
