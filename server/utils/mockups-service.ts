import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { applyJournalNote } from '../lib/actions';
import { dropCache } from '../lib/cache';
import { unpackMockup, mockupOf, type MockupFile } from '../lib/design-mockups';
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

export function importMockup(root: string, input: { screen: string; name: string; content: Buffer; title?: string; actor: string }): { record: IndexRecord | undefined; files: string[] } {
  const normalized = normalizeRoot(root);
  const screen = input.screen.trim();
  if (!screen) throw new MockupError('screen_required', 'Не назван экран: id из карты пользовательских путей');
  const unpacked = unpackMockup(input.name, input.content);
  if (unpacked.problems.length) throw new MockupError('mockup_path_invalid', unpacked.problems.join(' '));

  const workspace = readWorkspace(normalized);
  const records = analyze({ files: workspace.files, manifest: workspace.manifest }).records;
  const existing = records.find((record) => mockupOf(record)?.screen === screen && !['superseded', 'dropped', 'legacy'].includes(record.status));
  if (existing && isSettled(existing.status)) {
    throw new MockupError('mockup_approved', `Макет экрана «${screen}» уже подтверждён (${existing.id}): заведите преемника с \`supersedes\`, подтверждённое не перезаписывается`, 409);
  }

  const dir = mockupsDir(normalized);
  const slug = screenSlug(screen);
  const folder = resolveInside(normalized, `${dir}/${slug}`);
  // Новая версия заменяет прежнюю целиком: файлы старого экспорта не должны висеть рядом.
  if (existsSync(folder)) rmSync(folder, { recursive: true, force: true });
  const written = writeFiles(normalized, `${dir}/${slug}`, unpacked.files);
  const stamp = journalNow(normalized);

  if (existing) {
    const context = openRecord(normalized, existing.id);
    if (context) saveRecord(context, applyJournalNote(context.original, { action: `макет обновлён: ${input.name}`, actor: input.actor, today: stamp }), normalized);
    return { record: loadIndex(normalized, true).records.find((record) => record.id === existing.id), files: written };
  }

  const id = nextId('design', records.map((record) => record.id));
  const title = input.title?.trim() || `Экран «${screen}»`;
  const relative = targetPath(DEVELOPMENT_DIR, workspace.manifest.paths ?? {}, 'design', id, title);
  const absolute = resolveInside(normalized, relative);
  const text = recordTemplate({
    id, type: 'design', title, today: stamp,
    body: `Макет экрана «${screen}» из Claude Design: \`${recordMockupPath(dir, slug)}\`. Смотреть — на вкладке «Экраны» дизайна; что в нём важно и чего не трогать — допишите здесь.`,
    sources: [input.name]
  }).replace(/^(updated: .*)$/m, `$1\nscreen: ${JSON.stringify(screen)}\nmockup: ${recordMockupPath(dir, slug)}`);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text, 'utf8');
  dropCache(normalized);
  return { record: loadIndex(normalized, true).records.find((record) => record.id === id), files: written };
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
