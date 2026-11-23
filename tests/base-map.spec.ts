// Базовая карта и четыре обязательных шаблона (R-0140, V-0150).
import { describe, expect, it } from 'vitest';

import { analyze, type SourceFile } from '../server/lib/analyze';
import { MAP_TEMPLATES, missingRequired, REQUIRED_TEMPLATES, templateOfKind } from '../server/lib/map-core';

const strategicMap: SourceFile = {
  source: { path: 'docs/development/maps/M-0001-m.md' },
  text: `---\nid: M-0001\ntype: map\ntitle: Карта\nstatus: approved\ncreated: 2026-11-23\nupdated: 2026-11-23\n---\n\n# Карта\n\n\`\`\`docdd-functional\n${JSON.stringify({ added: { capabilities: [{ id: 'a', title: 'А', summary: 'Нужна' }] } })}\n\`\`\`\n\n## Журнал\n\n- 2026-11-23 · заведена · тест\n`
};

const missing = (files: SourceFile[], code: string[] = []) => analyze({
  files,
  manifest: { contract: 'docdd.workspace/1', project: { id: 'demo', name: 'Demo' }, paths: { maps: 'maps' }, ...(code.length ? { sources: { code } } : {}) },
  codeFiles: []
}).violations.filter((item) => item.code === 'map_required_missing').map((item) => item.message);

describe('шаблоны карт', () => {
  it('четыре обязательных: стратегическая, доменная, System Design, кодовая база', () => {
    expect(REQUIRED_TEMPLATES.map((item) => item.id)).toEqual(['strategic', 'domain', 'sysdesign', 'codebase']);
    expect(MAP_TEMPLATES.filter((item) => !item.required).map((item) => item.id)).toEqual(['dataflow', 'userflow']);
  });

  it('старые виды в файлах называют свой шаблон: functional — стратегическая, codemap — кодовая база', () => {
    expect(templateOfKind('functional')?.id).toBe('strategic');
    expect(templateOfKind('codemap')?.id).toBe('codebase');
  });

  it('System Design имеет собственный блок и входит в обязательные карты', () => {
    expect(missingRequired(new Set(), true).map((item) => item.id)).toEqual(['strategic', 'domain', 'sysdesign', 'codebase']);
  });
});

describe('map_required_missing (V-0150)', () => {
  it('проект без доменной карты: предупреждение её называет', () => {
    const found = missing([strategicMap], ['src']);
    expect(found).toHaveLength(3);
    expect(found).toEqual(expect.arrayContaining([expect.stringContaining('доменной'), expect.stringContaining('sysdesign'), expect.stringContaining('кодовой базы')]));
  });

  it('у проекта без кода кодовую базу не требует', () => {
    expect(missing([strategicMap])).toEqual([expect.stringContaining('доменной'), expect.stringContaining('sysdesign')]);
  });

  it('проект, ещё не заведший ни одной карты, пропусками не засыпается', () => {
    expect(missing([], ['src'])).toEqual([]);
  });
});
