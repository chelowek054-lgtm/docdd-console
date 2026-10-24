// Связи между картами (R-0086, docs/07-maps.md).
import { describe, expect, it } from 'vitest';

import { brokenMapLinks, mapLinkBacklinks, parseMapLink } from '../server/lib/functional';

describe('связи между картами', () => {
  it('разбирает «вид:узел»', () => {
    expect(parseMapLink('codemap:cache')).toEqual({ kind: 'codemap', node: 'cache' });
    expect(parseMapLink('godot-client:player.move')).toEqual({ kind: 'godot-client', node: 'player.move' });
    expect(parseMapLink('без двоеточия')).toBeNull();
  });
  it('обратная сторона: у узла — возможности, что на него ссылаются', () => {
    const index = mapLinkBacklinks([{ id: 'a', mapLinks: ['codemap:cache'] }, { id: 'b', mapLinks: ['codemap:cache', 'userflow:login'] }]);
    expect(index.get('codemap:cache')).toEqual(['a', 'b']);
    expect(index.get('userflow:login')).toEqual(['b']);
  });
  it('битая ссылка: нет узла и не по форме', () => {
    const known = new Set(['codemap:cache']);
    const found = brokenMapLinks([{ id: 'a', mapLinks: ['codemap:cache', 'codemap:ghost', 'мусор'] }], known);
    expect(found).toEqual([
      { capability: 'a', link: 'codemap:ghost', reason: 'missing' },
      { capability: 'a', link: 'мусор', reason: 'format' }
    ]);
  });
});
