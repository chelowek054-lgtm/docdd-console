import { describe, expect, it } from 'vitest';

import { manualReportText, verifiedJournalAction } from '../server/lib/manual-report';
import { latestVerificationDetails } from '../server/lib/reports';
import type { Report } from '../server/lib/types';

const NOW = new Date('2026-10-20T10:00:00.000Z');

describe('manualReportText с кто проверил и что проверено', () => {
  it('кладёт checked_by и note, runner остаётся manual:<роль>', () => {
    const report = JSON.parse(manualReportText('V-0001', 'passed', 'architect', NOW, { by: ' Иван ', note: 'Открыл экран, прошёл путь' }));
    expect(report.runner).toBe('manual:architect');
    expect(report.contract).toBe('docdd.workspace/1');
    expect(report.checked_by).toBe('Иван');
    expect(report.note).toBe('Открыл экран, прошёл путь');
  });

  it('без by и note полей в отчёте нет', () => {
    const report = JSON.parse(manualReportText('V-0001', 'passed', 'architect', NOW));
    expect(report).not.toHaveProperty('checked_by');
    expect(report).not.toHaveProperty('note');
    expect(report.runner).toBe('manual:architect');
    const blank = JSON.parse(manualReportText('V-0001', 'skipped', '', NOW, { by: '  ', note: '' }));
    expect(blank).not.toHaveProperty('checked_by');
    expect(blank.runner).toBe('manual');
  });
});

describe('ручная приёмка автоматического вида', () => {
  it('verification_kind попадает в отчёт только когда вид передан', () => {
    const auto = JSON.parse(manualReportText('V-0002', 'passed', 'architect', NOW, { by: 'Иван', note: 'глазами', kind: 'unit' }));
    expect(auto.verification_kind).toBe('unit');
    expect(JSON.parse(manualReportText('V-0001', 'passed', 'architect', NOW, { note: 'x' }))).not.toHaveProperty('verification_kind');
  });

  it('журнал называет вид', () => {
    expect(verifiedJournalAction(true, 'architect', { by: 'Иван', note: 'глазами', kind: 'unit' }))
      .toBe('проверена вручную (вид unit) · architect · проверил Иван · глазами');
  });

  it('вид из отчёта доходит до экрана как manualKind', () => {
    const reports: Report[] = [{
      contract: 'docdd.workspace/1', runner: 'manual:architect', started_at: '2026-10-20T10:00:00.000Z',
      verification_kind: 'unit', verifications: { 'V-0002': 'passed' }
    }];
    expect(latestVerificationDetails(reports).get('V-0002')).toMatchObject({ manualKind: 'unit' });
  });
});

describe('verifiedJournalAction', () => {
  it('без аргументов — прежняя подпись, снятие — как раньше', () => {
    expect(verifiedJournalAction(true)).toBe('проверена вручную');
    expect(verifiedJournalAction(false)).toBe('отметка «проверено» снята');
    expect(verifiedJournalAction(false, 'architect', { by: 'Иван', note: 'x' })).toBe('отметка «проверено» снята');
  });

  it('роль, имя и заметка через « · »', () => {
    expect(verifiedJournalAction(true, 'architect', { by: 'Иван', note: 'прошёл путь' }))
      .toBe('проверена вручную · architect · проверил Иван · прошёл путь');
  });

  it('заметка без переводов строки и обрезана до 120 знаков', () => {
    const line = verifiedJournalAction(true, 'a', { by: 'И', note: `первая\nвторая ${'я'.repeat(200)}` });
    expect(line).not.toContain('\n');
    expect(line).toContain('первая вторая');
    const note = line.split(' · ')[3] ?? '';
    expect(note.length).toBeLessThanOrEqual(120);
    expect(note.endsWith('…')).toBe(true);
  });
});

describe('разбор отчёта в VerificationOutcome', () => {
  it('checkedBy и note появляются только у ручной отметки', () => {
    const reports: Report[] = [
      { contract: 'docdd.workspace/1', runner: 'vitest', started_at: '2026-10-19T10:00:00.000Z', verifications: { 'V-0002': 'passed' } },
      {
        contract: 'docdd.workspace/1',
        runner: 'manual:architect',
        started_at: '2026-10-20T10:00:00.000Z',
        checked_by: 'Иван',
        note: 'прошёл путь',
        verifications: { 'V-0001': 'passed' }
      }
    ];
    const details = latestVerificationDetails(reports);
    expect(details.get('V-0001')).toMatchObject({ runner: 'manual:architect', checkedBy: 'Иван', note: 'прошёл путь' });
    const auto = details.get('V-0002');
    expect(auto).not.toHaveProperty('checkedBy');
    expect(auto).not.toHaveProperty('note');
  });
});
