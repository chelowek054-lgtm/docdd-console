// HTML-макеты экранов из Claude Design (V-0113, R-0106).
import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { MOCKUP_LIMIT, mockupColors, mockupOf, normalizeColor, offTokenColors, safeEntryPath, unpackMockup, withSizeProbe, withTheme } from '../server/lib/design-mockups';
import { buildInventory, captureScript } from '../server/lib/design-screens';
import { mockupRules } from '../server/lib/rules';
import { VIOLATION_LEVELS } from '../server/lib/types';
import { context, rec } from './helpers';

/** Zip в памяти: записи deflate, как отдаёт экспорт. */
function zip(entries: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = deflateRawSync(Buffer.from(text, 'utf8'));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(text.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(8, 10); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(text.length, 24); head.writeUInt16LE(nameBuf.length, 28); head.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    central.push(head, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

describe('раскладка загруженного макета', () => {
  it('HTML ложится как index.html', () => {
    expect(unpackMockup('login.html', Buffer.from('<p>x</p>')).files.map((file) => file.path)).toEqual(['index.html']);
  });

  it('zip: общий каталог срезается, единственный .html становится index.html, файлы рядом', () => {
    const out = unpackMockup('export.zip', zip({ 'Login/screen.html': '<img src="img/a.png">', 'Login/img/a.png': 'PNG' }));
    expect(out.problems).toEqual([]);
    expect(out.files.map((file) => file.path).sort()).toEqual(['img/a.png', 'index.html']);
  });

  it('отказ: .., абсолютный путь, несколько .html без index.html, превышение лимита, не тот формат', () => {
    expect(safeEntryPath('../etc/passwd')).toBeNull();
    expect(safeEntryPath('C:/x.html')).toBeNull();
    expect(safeEntryPath('/x.html')).toBeNull();
    expect(unpackMockup('a.zip', zip({ '../a.html': 'x' })).problems[0]).toMatch(/за пределами/);
    expect(unpackMockup('a.zip', zip({ 'a.html': 'x', 'b.html': 'y' })).problems[0]).toMatch(/несколько/);
    expect(unpackMockup('a.html', Buffer.alloc(MOCKUP_LIMIT + 1)).problems[0]).toMatch(/МБ/);
    expect(unpackMockup('a.pdf', Buffer.from('x')).problems[0]).toMatch(/\.html или \.zip/);
  });
});

describe('цвета макета и токены', () => {
  it('hex, rgb, hsl приводятся к #rrggbb; скрипты не в счёт', () => {
    expect([normalizeColor('#FFF'), normalizeColor('rgb(255, 0, 0)'), normalizeColor('hsl(120, 100%, 50%)'), normalizeColor('#11223380')]).toEqual(['#ffffff', '#ff0000', '#00ff00', '#112233']);
    expect(mockupColors('<style>a{color:#123456;background:rgba(0,0,255,.5)}</style><script>const c="#abcdef"</script>')).toEqual(['#123456', '#0000ff']);
  });

  it('вне токенов — то, чего нет в палитре; белое и чёрное допустимы', () => {
    expect(offTokenColors(['#123456', '#ffffff', '#0000ff'], ['#0000FF'])).toEqual(['#123456']);
  });
});

describe('тема при отдаче', () => {
  it('data-theme, color-scheme и класс dark на корне; прежний class сохраняется', () => {
    const html = withTheme('<html lang="ru" class="app" data-theme="x"><body></body></html>', 'dark', true);
    expect(html).toContain('lang="ru"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('class="app dark"');
    expect(html).toContain('color-scheme: dark');
    expect(withTheme('<p>x</p>', 'light', false)).toBe('<html data-theme="light" style="color-scheme: light"><p>x</p></html>');
  });
});

describe('размер макета для холста', () => {
  it('скрипт размера встаёт перед последним </body> и несёт id экрана', () => {
    const html = withSizeProbe('<html><body><p>x</p></body></html>', 'login');
    expect(html).toMatch(/<script>.*docddMockup:"login".*<\/script><\/body><\/html>$/s);
    expect(withSizeProbe('<p>x</p>', '</script>')).toContain('docddMockup:"\\u003c/script>"');
  });
});

describe('документ-макет в описи и скрипте снятия', () => {
  it('экран карты получает HTML-макет; экран вне карты тоже в описи; скрипт снимает макеты', () => {
    const inventory = buildInventory({ screens: [{ id: 'login' }], files: [{ path: 'docs/development/design/mockups/login/375-light.png', mtimeMs: 1 }], widths: [375], themes: ['light'], html: [{ screen: 'login', record: 'D-0001', status: 'draft' }, { screen: 'extra', record: 'D-0002', status: 'draft' }] });
    expect(inventory.screens.map((screen) => [screen.id, screen.html?.record, screen.html?.shots[0]?.present])).toEqual([['login', 'D-0001', true], ['extra', 'D-0002', false]]);
    expect(captureScript(inventory)).toContain("const mockups = ['login', 'extra'];");
    expect(mockupOf(rec('D-0001', 'design', 'draft', { extra: { screen: 'login', mockup: 'design/mockups/login/index.html' } }))).toEqual({ screen: 'login', mockup: 'design/mockups/login/index.html' });
  });
});

describe('правила сверки — предупреждения', () => {
  const map = rec('M-0001', 'map', 'approved', { body: [
    '# Карта', '', '```docdd-userflow', JSON.stringify({ added: { screens: [{ id: 'login', title: 'Вход' }, { id: 'home', title: 'Главная' }] } }), '```', '',
    '```docdd-functional', JSON.stringify({ added: { capabilities: [{ id: 'auth', title: 'Вход', priority: 'must', mapLinks: ['userflow:home'] }] } }), '```', ''
  ].join('\n') });

  it('неизвестный экран и экран must-возможности без макета', () => {
    const mockup = rec('D-0001', 'design', 'draft', { extra: { screen: 'nowhere', mockup: 'design/mockups/nowhere/index.html' } });
    const found = mockupRules(context([map, mockup]));
    expect(found.map((item) => item.code).sort()).toEqual(['mockup_screen_unknown', 'screen_mockup_missing']);
    expect(found.every((item) => VIOLATION_LEVELS[item.code] === 'warning')).toBe(true);
  });

  it('без единого HTML-макета правила молчат', () => {
    expect(mockupRules(context([map]))).toEqual([]);
  });
});
