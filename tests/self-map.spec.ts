import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { approvedMaps, checkEvidence, currentEvidenceClaims, parseMapRecord } from '../server/lib/maps';
import { parseRecord } from '../server/lib/parse';

/**
 * Карта самого репозитория. Инструмент требует от чужих проектов, чтобы код не
 * расходился с картой, — значит и от себя тоже: правка кода без правки карты
 * должна ронять сборку здесь, а не выясняться через полгода.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const mapsDir = join(root, 'docs', 'development', 'maps');

const records = existsSync(mapsDir)
  ? readdirSync(mapsDir).filter((name) => name.endsWith('.md'))
  : [];
const approved = approvedMaps(records.flatMap((name) => {
  const parsed = parseRecord(readFileSync(join(mapsDir, name), 'utf8'), { path: name });
  return parsed.ok ? [parsed.record] : [];
})).filter((record) => record.data['intent'] !== true);
const evidenceByRecord = currentEvidenceClaims(approved.map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));

describe('карта этого репозитория', () => {
  it('заведена: репозиторий живёт по своему же формату', () => {
    expect(existsSync(join(root, 'docs', 'development', 'project.yaml'))).toBe(true);
    expect(records.length).toBeGreaterThan(0);
  });

  for (const name of records) {
    const text = readFileSync(join(mapsDir, name), 'utf8');
    const parsed = parseMapRecord(text);
    // Карта может нести только `docdd-skipped` — список не-модулей, без
    // структур и свидетельств (docs/07-maps.md, «Не всё попадает в карту»).
    // Функциональная карта свидетельств не несёт (docs/07-maps.md): сверять нечего,
    // схему же проверяет первый тест выше.
    const claims = evidenceByRecord.get(name.slice(0, 6)) ?? [];

    it(`${name}: разбирается без претензий схемы`, () => {
      expect(parsed.problems).toEqual([]);
    });

    it.skipIf(!claims.length)(`${name}: каждое свидетельство сходится с файлом`, () => {
      const failed = claims
        .map((claim) => {
          const path = join(root, claim.evidence.path);
          const source = existsSync(path) ? readFileSync(path, 'utf8') : null;
          return { claim, verdict: checkEvidence(claim.evidence, source, claim.side) };
        })
        .filter((item) => item.verdict !== 'ok')
        .map((item) => `${item.verdict}: ${item.claim.label} (${item.claim.evidence.path}:${item.claim.evidence.line})`);

      // Расхождение здесь означает одно из двух: код уехал из-под карты или
      // карта описывает то, чего нет. И то и другое чинится до слияния.
      expect(failed).toEqual([]);
    });
  }
});
