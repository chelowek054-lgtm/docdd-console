import { expect, it } from 'vitest';
import { visualMapDraft, type EditableMapTemplate } from '../app/utils/visual-map-draft';
import { parseMapRecord } from '../server/lib/maps';

it.each<[EditableMapTemplate, string, string]>([
  ['strategic', 'functional', 'uses'],
  ['domain', 'domain', 'owns'],
  ['sysdesign', 'sysdesign', 'depends']
])('emits valid %s node and edge patches', (template, structure, type) => {
  const kind = template === 'domain' ? 'context' : template === 'sysdesign' ? 'container' : 'capability';
  const draft = visualMapDraft(template,
    [{ id: 'group', title: 'Group', summary: 'Responsibilities', kind },
      { id: 'first', title: 'First', summary: 'Handles requests', parent: 'group', kind }],
    [{ from: 'group', to: 'first', type, summary: 'Operation' }],
    ['old'],
    [{ from: 'first', to: 'old', type }]
  );
  const parsed = parseMapRecord(draft);
  expect(parsed.present).toEqual([structure]);
  expect(parsed.problems).toEqual([]);
  expect(draft).toContain('"parent": "group"');
  expect(draft).toContain(template === 'sysdesign' ? '"reference": "Responsibilities"' : '"summary": "Responsibilities"');
});
