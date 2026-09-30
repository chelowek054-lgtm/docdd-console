import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  isManualKind,
  manualReportName,
  manualReportText,
  manualRunner,
  verifiedJournalAction
} from '../server/lib/manual-report';
import { loadIndex } from '../server/utils/index-service';
import { markVerified } from '../server/utils/verified-service';

/**
 * Ручная отметка «Проверено»: факт фиксируется отчётом, как любой прогон, а
 * след — строкой в журнале (docs/02-workspace-contract.md).
 */

describe('manual-report', () => {
  it('только manual и review прогоняет человек', () => {
    expect(isManualKind('manual')).toBe(true);
    expect(isManualKind('review')).toBe(true);
    for (const kind of ['unit', 'integration', 'metric', undefined, 7]) expect(isManualKind(kind)).toBe(false);
  });

  it('runner несёт роль; без роли — просто manual', () => {
    expect(manualRunner('architect')).toBe('manual:architect');
    expect(manualRunner('')).toBe('manual');
  });

  it('имя отчёта не затирает прежние: время до миллисекунд', () => {
    const a = manualReportName('V-0013', new Date('2026-10-01T09:15:00.123Z'));
    const b = manualReportName('V-0013', new Date('2026-10-01T09:15:00.456Z'));
    expect(a).toBe('2026-10-01-manual-V-0013-091500123.json');
    expect(a).not.toBe(b);
  });

  it('отчёт проходит контракт: последний результат проверки и кто отметил', () => {
    const report = JSON.parse(manualReportText('V-0013', 'passed', 'architect', new Date('2026-10-01T09:15:00.000Z')));
    expect(report).toMatchObject({
      contract: 'docdd.workspace/1',
      runner: 'manual:architect',
      total: 1,
      failed: 0,
      verifications: { 'V-0013': 'passed' }
    });
  });

  it('слова журнала', () => {
    expect(verifiedJournalAction(true)).toBe('проверена вручную');
    expect(verifiedJournalAction(false)).toBe('отметка «проверено» снята');
  });
});

const LF = String.fromCharCode(10);
let root = '';

function check(id: string, kind: string, status = 'approved'): string {
  return [
    '---', `id: ${id}`, 'type: verification', `title: Проверка ${id}`, `status: ${status}`, `kind: ${kind}`,
    'created: 2026-09-01', 'updated: 2026-09-01', '---', '',
    `# Проверка ${id}`, '', 'Пройдена руками.', '', '## Журнал', '', '- 2026-09-01 · заведена · architect', ''
  ].join(LF);
}

function put(name: string, text: string) {
  mkdirSync(join(root, 'docs', 'development', 'tests'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'tests', name), text, 'utf8');
}

const reports = () => readdirSync(join(root, 'docs', 'development', 'tests', 'reports'));

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-verified-'));
  mkdirSync(join(root, 'docs', 'development'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  tests: tests', ''
  ].join(LF), 'utf8');

  put('V-0001-manual.md', check('V-0001', 'manual'));
  put('V-0002-unit.md', check('V-0002', 'unit'));
  put('V-0003-draft.md', check('V-0003', 'review', 'draft'));
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Прибирать не обязательно.
  }
});

describe('markVerified', () => {
  it('ставит отметку: отчёт, факт passed от ручного прогона и строка в журнале подтверждённой проверки', () => {
    const outcome = markVerified(root, 'V-0001', true, 'architect');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result).toMatchObject({ state: 'passed', runner: 'manual:architect' });
    expect(outcome.journal).toContain('проверена вручную');
    expect(reports()).toHaveLength(1);

    const text = readFileSync(join(root, 'docs', 'development', 'tests', 'V-0001-manual.md'), 'utf8');
    expect(text).toContain('проверена вручную · architect');
    // Тело подтверждённой записи не тронуто: отметка — факт, а не правка содержимого.
    expect(text).toContain('Пройдена руками.');
    expect(text).toContain('status: approved');
  });

  it('снимает отметку: новый отчёт skipped, прежний и журнал остаются', () => {
    const outcome = markVerified(root, 'V-0001', false, 'architect');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result?.state).toBe('skipped');
    expect(reports()).toHaveLength(2);

    const text = readFileSync(join(root, 'docs', 'development', 'tests', 'V-0001-manual.md'), 'utf8');
    expect(text).toContain('проверена вручную · architect');
    expect(text).toContain('отметка «проверено» снята · architect');
  });

  it('отметка в один миг подряд не затирает отчёты друг друга', () => {
    markVerified(root, 'V-0001', true, 'architect');
    markVerified(root, 'V-0001', false, 'architect');
    markVerified(root, 'V-0001', true, 'architect');
    expect(new Set(reports()).size).toBe(reports().length);
    expect(loadIndex(root, true).verificationResults['V-0001']?.state).toBe('passed');
  });

  it('автоматической проверке отметку не поставить: факт приходит от сборки', () => {
    const before = reports().length;
    const outcome = markVerified(root, 'V-0002', true, 'architect');

    expect(outcome).toMatchObject({ ok: false, status: 409, code: 'not_manual' });
    expect(reports()).toHaveLength(before);
  });

  it('черновую проверку отметить можно: статус не мешает', () => {
    const outcome = markVerified(root, 'V-0003', true, 'architect');
    expect(outcome.ok).toBe(true);
  });

  it('не проверка и несуществующая запись — свои коды', () => {
    expect(markVerified(root, 'V-9999', true, '')).toMatchObject({ ok: false, status: 404, code: 'record_not_found' });
  });
});
