// Вложения к прогону и дефекту: проверка файла и путь (R-0099, docs/02-workspace-contract.md).
import { describe, expect, it } from 'vitest';

import { MAX_ATTACHMENT_BYTES, attachmentFolder, attachmentKind, checkAttachment, isAttachmentPath, safeName } from '../server/lib/attachments';

describe('допустимость файла', () => {
  it('картинка и лог проходят, вид определяется по расширению', () => {
    expect(checkAttachment('экран.PNG', 1000)).toMatchObject({ ok: true, kind: 'image', ext: 'png' });
    expect(checkAttachment('run.log', 10)).toMatchObject({ ok: true, kind: 'log' });
  });
  it('чужой тип, пустой и слишком большой отклоняются', () => {
    expect(checkAttachment('virus.exe', 10)).toMatchObject({ ok: false, code: 'type_not_allowed' });
    expect(checkAttachment('a.png', 0)).toMatchObject({ ok: false, code: 'empty' });
    expect(checkAttachment('a.png', MAX_ATTACHMENT_BYTES + 1)).toMatchObject({ ok: false, code: 'too_large' });
    expect(checkAttachment('', 10)).toMatchObject({ ok: false, code: 'name_required' });
  });
  it('имя очищается от путей', () => {
    expect(safeName('../../etc/passwd.log')).toBe('passwd.log');
    expect(safeName('C:\\temp\\скрин шот.png')).toBe('скрин-шот.png');
  });
});

describe('путь вложения', () => {
  it('папка — рядом с отчётами, по дате', () => {
    expect(attachmentFolder('tests', '2026-10-22')).toBe('docs/development/tests/attachments/2026-10-22');
  });
  it('годен только путь внутри attachments без выхода наверх', () => {
    expect(isAttachmentPath('docs/development/tests/attachments/2026-10-22/a.png')).toBe(true);
    expect(isAttachmentPath('docs/development/tests/attachments/2026-10-22/../../x.png')).toBe(false);
    expect(isAttachmentPath('docs/development/tests/reports/a.json')).toBe(false);
    expect(isAttachmentPath('/etc/attachments/d/a.png')).toBe(false);
    expect(attachmentKind('x/attachments/d/a.log')).toBe('log');
  });
});
