import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { cachePath, dropCache, readCache, writeCache } from '../server/lib/cache';
import { buildIndex } from '../server/lib/indexer';
import { readWorkspace } from '../server/lib/workspace';

/**
 * Проверка сборки индекса на настоящей папке: файловая система есть у теста,
 * ядро по-прежнему получает строки. Проект-пример тот же, что у фазы 1.
 */

const root = fileURLToPath(new URL('./fixtures/example-project/', import.meta.url)).replace(/[\\/]$/, '');
const now = new Date('2026-08-30T12:00:00Z');

afterAll(() => {
  // Кэш производный: тест обязан оставить папку такой, какой взял.
  dropCache(root);
});

describe('readWorkspace', () => {
  it('читает манифест, записи, отчёты и файлы кода', () => {
    const workspace = readWorkspace(root);
    expect(workspace.manifest.project.id).toBe('fishforecast');
    expect(workspace.files.length).toBeGreaterThan(20);
    expect(workspace.reports).toHaveLength(1);
    expect(workspace.codeFiles).toContain('app/src/bite.ts');
  });

  it('раздел записи берётся из манифеста, а не из зашитого имени папки', () => {
    const workspace = readWorkspace(root);
    const task = workspace.files.find((file) => file.source.path.endsWith('T-0001-offline.md'));
    expect(task?.source.section).toBe('tasks');
  });
});

describe('buildIndex', () => {
  const { index } = buildIndex(root, now);

  it('отдаёт проект, время сборки и отпечаток', () => {
    expect(index.project).toEqual({
      id: 'fishforecast',
      name: 'FishForecast',
      contract: 'docdd.workspace/1',
      // Роли нужны экрану записи, чтобы подставить подпись в журнал.
      roles: [{ id: 'architect', name: 'Архитектор' }]
    });
    expect(index.builtAt).toBe('2026-08-30T12:00:00.000Z');
    expect(index.fingerprint).not.toBe('');
  });

  it('нарушения те же, что видит ядро: маршрут ничего не досчитывает', () => {
    expect(index.issues.filter((issue) => issue.severity === 'error').length).toBeGreaterThan(0);
    expect(index.issues.some((issue) => issue.code === 'task_stale' && issue.recordId === 'T-0002')).toBe(true);
    expect(index.issues.every((issue) => issue.path !== '')).toBe(true);
  });

  it('строит обратные связи, которых нет в файлах', () => {
    const requirement = index.records.find((record) => record.id === 'R-0001');
    expect(requirement?.backlinks.implements).toContain('T-0001');
  });

  it('незнакомые поля front matter уходят в extra, а не теряются', () => {
    const withExtra = index.records.find((record) => record.id === 'V-0001');
    expect(withExtra?.extra).toHaveProperty('kind', 'unit');
  });

  it('результат проверки несёт время прогона и раннер', () => {
    expect(index.verificationResults['V-0001']).toEqual({
      state: 'passed',
      at: '2026-08-30T10:00:00Z',
      runner: 'npm'
    });
    expect(index.verificationResults['V-0003']).toBeUndefined();
  });

  it('нечитаемый файл не мешает собрать остальные', () => {
    expect(index.records.some((record) => record.id === 'T-0001')).toBe(true);
    expect(index.issues.some((issue) => issue.code === 'parse_failed')).toBe(true);
  });
});

describe('кэш индекса', () => {
  it('годен, пока совпадает отпечаток, и негоден, как только он разошёлся', () => {
    const { index } = buildIndex(root, now);
    writeCache(root, index);

    expect(readCache(root, index.fingerprint)?.builtAt).toBe(index.builtAt);
    expect(readCache(root, 'другой-отпечаток')).toBeNull();
  });

  it('удаление кэша ничего не ломает: он производный', () => {
    const { index } = buildIndex(root, now);
    writeCache(root, index);
    expect(existsSync(cachePath(root))).toBe(true);

    rmSync(cachePath(root));
    expect(readCache(root, index.fingerprint)).toBeNull();
    expect(buildIndex(root, now).index.records.length).toBe(index.records.length);
  });
});
