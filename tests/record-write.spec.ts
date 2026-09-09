import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyFieldPatch, applyStatusChange } from '../server/lib/actions';
import { openRecord, saveRecord, today } from '../server/utils/record-write';

/**
 * Запись, у которой front matter уже не проходит схему (создана в обход
 * приложения — руками, не через нормальный путь), не должна становиться
 * неприкасаемой навсегда: правка, не трогающая сломанное поле, обязана
 * пройти, иначе у записи нет ни одного доступного действия — тупик
 * (docs/03-server-api.md, «Правка полей front matter»).
 */

const LF = String.fromCharCode(10);
let root = '';

function invalidVerification(status: string): string {
  // `verification` требует `kind` — здесь его нет: то же самое, что вышло бы
  // при ручной записи файла в обход схемы.
  return [
    '---',
    'id: V-0001',
    'type: verification',
    'title: Тесты',
    `status: ${status}`,
    'created: 2026-09-08',
    'updated: 2026-09-08',
    '---',
    '',
    '# Тесты',
    '',
    'Тело записи.',
    '',
    '## Журнал',
    '',
    '- 2026-09-08 · заведена · architect',
    ''
  ].join(LF);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-record-write-'));
  mkdirSync(join(root, 'docs', 'development', 'tests'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1',
    'project:',
    '  id: demo',
    '  name: Demo',
    'paths:',
    '  tests: tests',
    ''
  ].join(LF), 'utf8');
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Прибирать не обязательно.
  }
});

describe('saveRecord — запись, уже сломанная до правки', () => {
  it('правка, не трогающая сломанное поле, проходит — иначе у записи нет ни одного действия', () => {
    const path = join(root, 'docs', 'development', 'tests', 'V-0001-testy.md');
    writeFileSync(path, invalidVerification('approved'), 'utf8');

    const context = openRecord(root, 'V-0001');
    expect(context).not.toBeNull();

    const outcome = applyStatusChange(context!.original, { status: 'superseded', actor: 'architect', today: today() });
    const saved = saveRecord(context!, outcome, root);
    expect(saved.ok, saved.ok ? '' : saved.problems.join(' ')).toBe(true);
  });

  it('links-правка на той же сломанной записи тоже проходит', () => {
    const path = join(root, 'docs', 'development', 'tests', 'V-0002-testy.md');
    writeFileSync(path, invalidVerification('approved').replace('V-0001', 'V-0002'), 'utf8');

    const context = openRecord(root, 'V-0002');
    const outcome = applyFieldPatch(context!.original, { owner: 'architect' }, today());
    const saved = saveRecord(context!, outcome, root);
    expect(saved.ok, saved.ok ? '' : saved.problems.join(' ')).toBe(true);
  });

  it('но новое нарушение, которого не было до правки, всё ещё отказ', () => {
    const path = join(root, 'docs', 'development', 'tests', 'V-0003-testy.md');
    writeFileSync(path, invalidVerification('approved').replace('V-0001', 'V-0003'), 'utf8');

    const context = openRecord(root, 'V-0003');
    // `unknown_type` вдобавок к уже сломанному `kind` — новая беда, не та же самая.
    const outcome = { text: context!.original.replace('type: verification', 'type: adr'), problems: [] };
    const saved = saveRecord(context!, outcome, root);
    expect(saved.ok).toBe(false);
  });

  it('запись без предсуществующих проблем по-прежнему отказывает на новых', () => {
    const path = join(root, 'docs', 'development', 'tests', 'V-0004-testy.md');
    writeFileSync(path, [
      '---',
      'id: V-0004',
      'type: verification',
      'title: Тесты',
      'status: draft',
      'created: 2026-09-08',
      'updated: 2026-09-08',
      'kind: unit',
      '---',
      '',
      '# Тесты',
      '',
      'Тело записи.',
      '',
      '## Журнал',
      '',
      '- 2026-09-08 · заведена · architect',
      ''
    ].join(LF), 'utf8');

    const context = openRecord(root, 'V-0004');
    const outcome = { text: context!.original.replace('kind: unit', ''), problems: [] };
    const saved = saveRecord(context!, outcome, root);
    expect(saved.ok).toBe(false);
  });
});
