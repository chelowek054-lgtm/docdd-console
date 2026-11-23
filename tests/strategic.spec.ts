// Стратегическая карта: обязательное от модели и полный контроль человека (R-0147, V-0157).
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { editorDraft } from '../app/utils/map-flow';
import { blockText, lintStrategicChange, shortStrategicMap, standardFor } from '../server/lib/map-core';
import { parseMapRecord } from '../server/lib/maps';
import { createRecords } from '../server/utils/inbox-service';

const standard = standardFor('strategic')?.standard;
if (!standard) throw new Error('нет стандарта');

describe('раскладка допроса: карта без назначения не заводится (V-0157)', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'docdd-strategic-'));
    const dev = join(root, 'docs', 'development');
    mkdirSync(dev, { recursive: true });
    writeFileSync(join(dev, 'project.yaml'), 'contract: docdd.workspace/1\nproject:\n  id: p\n  name: P\npaths:\n  requirements: requirements\n  maps: maps\n');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('подставная модель забыла назначение: отказ линтера с узлом и полем, остальное плана заводится', () => {
    const outcome = createRecords(root, [
      { type: 'map', title: 'Карта магазина', capabilities: [{ id: 'shop', title: 'Магазин' }] },
      { type: 'requirement', title: 'Каталог книг' }
    ] as never, []);
    if (!outcome.ok) throw new Error('разбор не удался');
    expect(outcome.created.map((item) => item.type)).toEqual(['requirement']);
    expect(outcome.problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/shop.*summary|summary.*shop/),
      expect.stringContaining('запись не заведена')
    ]));
    expect(readdirSync(join(root, 'docs', 'development'))).not.toContain('maps');
  });

  it('с назначением карта заводится тем же путём', () => {
    const outcome = createRecords(root, [{ type: 'map', title: 'Карта', capabilities: [{ id: 'shop', title: 'Магазин', summary: 'Продаёт книги' }] }] as never, []);
    if (!outcome.ok) throw new Error('разбор не удался');
    expect(outcome.created.map((item) => item.type)).toEqual(['map']);
  });
});

describe('короткая форма и правка мышью', () => {
  it('«откуда, куда, зачем»: два узла и связь, проходит линтер', () => {
    const plan = shortStrategicMap({ from: 'Таблица заказов', to: 'Магазин в сети', why: 'Заказы без звонков' });
    if (!plan) throw new Error('формы нет');
    const parsed = parseMapRecord(blockText({ kind: 'strategic' }, plan));
    expect(parsed.problems).toEqual([]);
    expect(lintStrategicChange(parsed.change.functional, { capabilities: [] }, standard)).toEqual([]);
    expect(parsed.change.functional?.added?.relations).toEqual([{ from: 'now', to: 'goal', type: 'feeds', summary: 'Заказы без звонков' }]);
    expect(shortStrategicMap({ from: 'a', to: '', why: 'c' })).toBeNull();
  });

  it('правка и удаление в редакторе — added и removed одного черновика', () => {
    const answer = editorDraft([{ id: 'a', title: 'А2', summary: 'Новое назначение', status: 'implemented' }], [], ['b'], [{ from: 'a', to: 'b', type: 'uses' }]);
    const change = parseMapRecord(answer).change.functional;
    expect(change?.added?.capabilities?.[0]).toMatchObject({ id: 'a', title: 'А2', status: 'implemented' });
    expect(change?.removed?.capabilities).toEqual([{ id: 'b' }]);
    expect(change?.removed?.relations).toEqual([{ from: 'a', to: 'b', type: 'uses' }]);
  });
});
