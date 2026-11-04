import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { applyJournalNote } from '../lib/actions';
import { dropCache } from '../lib/cache';
import { BOARD_ASSETS, MOCKUP_LIMIT, parseBoard, unpackMockup, mockupOf, type MockupFile } from '../lib/design-mockups';
import { approvedMaps, foldMaps, parseMapRecord } from '../lib/maps';
import { slugify } from '../lib/scaffold';
import type { WorkRecord } from '../lib/types';
import { DEFAULT_MOCKUPS_DIR, screenSlug } from '../lib/design-screens';
import { targetPath } from '../lib/import';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { isSettled } from '../lib/actions';
import { nextId, recordTemplate } from '../lib/scaffold';
import { DEVELOPMENT_DIR, readManifest } from '../lib/workspace';
import type { IndexRecord } from '../lib/types';
import { analyze } from '../lib/analyze';
import { readWorkspace } from '../lib/workspace';
import { loadIndex } from './index-service';
import { journalNow, openRecord, saveRecord } from './record-write';

/**
 * Импорт HTML-макета экрана (R-0106, docs/03-server-api.md, `POST /design/mockups`).
 * Файлы — только под каталогом экрана; документ — черновик `design`, подтверждённый
 * не перезаписывается.
 */

export class MockupError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

/** Каталог макетов от корня проекта: из манифеста или по умолчанию. */
export function mockupsDir(root: string): string {
  return (readManifest(root).design?.mockups ?? DEFAULT_MOCKUPS_DIR).replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Путь макета, как его пишет документ: от `docs/development`. */
function recordMockupPath(dir: string, slug: string): string {
  const full = `${dir}/${slug}/index.html`;
  return full.startsWith(`${DEVELOPMENT_DIR}/`) ? full.slice(DEVELOPMENT_DIR.length + 1) : full;
}

/** Что стало с экраном при импорте: заведён, обновлён или пропущен — подтверждённое не трогаем. */
export interface ImportedScreen {
  screen: string;
  title: string;
  outcome: 'created' | 'updated' | 'skipped';
  record: string | null;
  message?: string;
}

export interface ImportOutcome {
  record: IndexRecord | undefined;
  files: string[];
  /** По экрану на строку; у одиночного HTML — одна. */
  screens: ImportedScreen[];
}

const OUT = ['superseded', 'dropped', 'rejected', 'legacy'];

export function importMockup(root: string, input: { screen: string; name: string; content: Buffer; title?: string; actor: string }): ImportOutcome {
  const normalized = normalizeRoot(root);
  const unpacked = unpackMockup(input.name, input.content);
  if (unpacked.problems.length) throw new MockupError('mockup_path_invalid', unpacked.problems.join(' '));

  const workspace = readWorkspace(normalized);
  const records = analyze({ files: workspace.files, manifest: workspace.manifest }).records;
  const dir = mockupsDir(normalized);
  const stamp = journalNow(normalized);
  const taken = records.map((record) => record.id);

  // Доска Claude Design: режем на экраны, каждый — свой кадр и свой документ.
  const main = unpacked.files.find((file) => file.path === 'index.html');
  let board: ReturnType<typeof parseBoard> = null;
  try {
    board = main ? parseBoard(main.data.toString('utf8')) : null;
  } catch (error) {
    // Сжатый кусок доски сверх предела — тот же отказ, что у архива (ADR-0039).
    if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') throw new MockupError('mockup_path_invalid', `Распакованная доска больше ${MOCKUP_LIMIT / 1024 / 1024} МБ.`);
    throw error;
  }
  if (board) {
    const written = writeFiles(normalized, `${dir}/${BOARD_ASSETS}`, board.assets.map((asset) => ({ path: asset.name, data: asset.data })));
    const byTitle = mapScreensByTitle(records);
    const screens: ImportedScreen[] = [];
    for (const page of board.pages) {
      // Экран карты путей с тем же названием — его id; нет — id из названия.
      const screen = byTitle.get(page.title.toLowerCase()) ?? slugify(page.title);
      const one = importOne(normalized, records, taken, { dir, screen, title: page.title, files: [{ path: 'index.html', data: Buffer.from(page.html, 'utf8') }], source: input.name, actor: input.actor, stamp });
      screens.push(one.screen);
      written.push(...one.files);
    }
    const first = screens.find((item) => item.record)?.record;
    return { record: first ? loadIndex(normalized, true).records.find((record) => record.id === first) : undefined, files: written, screens };
  }

  const screen = input.screen.trim();
  if (!screen) throw new MockupError('screen_required', 'Не назван экран: id из карты пользовательских путей');
  const one = importOne(normalized, records, taken, { dir, screen, title: input.title?.trim() || `Экран «${screen}»`, files: unpacked.files, source: input.name, actor: input.actor, stamp });
  if (one.screen.outcome === 'skipped') throw new MockupError('mockup_approved', one.screen.message ?? '', 409);
  return { record: loadIndex(normalized, true).records.find((record) => record.id === one.screen.record), files: one.files, screens: [one.screen] };
}

/** Экраны подтверждённой карты путей по названию: доска подписывает кадры названиями, а не id. */
function mapScreensByTitle(records: readonly WorkRecord[]): Map<string, string> {
  const picture = foldMaps(approvedMaps(records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));
  return new Map(picture.userflow.screens.filter((screen) => screen.title).map((screen) => [String(screen.title).toLowerCase(), screen.id]));
}

/**
 * Один экран: подтверждённый не перезаписывается (нужен преемник), черновик —
 * файлы заменяются и строка в журнал, нового — черновик документа.
 */
function importOne(
  root: string,
  records: readonly WorkRecord[],
  taken: string[],
  input: { dir: string; screen: string; title: string; files: readonly MockupFile[]; source: string; actor: string; stamp: string }
): { screen: ImportedScreen; files: string[] } {
  const { dir, screen, stamp } = input;
  const existing = records.find((record) => mockupOf(record)?.screen === screen && !OUT.includes(record.status));
  if (existing && isSettled(existing.status)) {
    return { screen: { screen, title: input.title, outcome: 'skipped', record: existing.id, message: `Макет экрана «${screen}» уже подтверждён (${existing.id}): заведите преемника с \`supersedes\`, подтверждённое не перезаписывается` }, files: [] };
  }

  const slug = screenSlug(screen);
  const folder = resolveInside(root, `${dir}/${slug}`);
  // Новая версия заменяет прежнюю целиком: файлы старого экспорта не должны висеть рядом.
  if (existsSync(folder)) rmSync(folder, { recursive: true, force: true });
  const written = writeFiles(root, `${dir}/${slug}`, input.files);

  if (existing) {
    const context = openRecord(root, existing.id);
    if (context) saveRecord(context, applyJournalNote(context.original, { action: `макет обновлён: ${input.source}`, actor: input.actor, today: stamp }), root);
    return { screen: { screen, title: input.title, outcome: 'updated', record: existing.id }, files: written };
  }

  const id = nextId('design', taken);
  taken.push(id);
  const title = input.title;
  const normalized = root;
  const workspace = readWorkspace(root);
  const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, 'design', id, title);
  const absolute = resolveInside(normalized, relative);
  const text = recordTemplate({
    id, type: 'design', title, today: stamp,
    body: `Макет экрана «${screen}» из Claude Design: \`${recordMockupPath(dir, slug)}\`. Смотреть — на вкладке «Экраны» дизайна; что в нём важно и чего не трогать — допишите здесь.`,
    sources: [input.source]
  }).replace(/^(updated: .*)$/m, `$1\nscreen: ${JSON.stringify(screen)}\nmockup: ${recordMockupPath(dir, slug)}`);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text, 'utf8');
  dropCache(normalized);
  return { screen: { screen, title, outcome: 'created', record: id }, files: written };
}

function writeFiles(root: string, base: string, files: readonly MockupFile[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    const target = resolveInside(root, `${base}/${file.path}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.data);
    out.push(`${base}/${file.path}`);
  }
  return out;
}

/** Файл макета для отдачи: только из каталога экрана; нет — `null`. */
export function readMockupFile(root: string, screen: string, path: string): { path: string; data: Buffer } | null {
  const normalized = normalizeRoot(root);
  const clean = path.replace(/\\/g, '/');
  if (clean.split('/').some((part) => part === '..') || clean.startsWith('/')) return null;
  const relative = `${mockupsDir(normalized)}/${screenSlug(screen)}/${clean || 'index.html'}`;
  const absolute = resolveInside(normalized, relative);
  return existsSync(absolute) ? { path: relative, data: readFileSync(absolute) } : null;
}
