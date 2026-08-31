import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { OutsideRootError, resolveInside, toProjectPath } from '../server/lib/paths';

/**
 * Граница корня — единственная защита локального сервера: аутентификации нет,
 * потому что нет удалённого доступа. Значит проверять её надо придирчиво.
 */

const root = fileURLToPath(new URL('./fixtures/example-project/', import.meta.url)).replace(/[\\/]$/, '');

describe('resolveInside', () => {
  it('пускает к файлу внутри корня', () => {
    const target = resolveInside(root, 'docs/development/project.yaml');
    expect(target.replace(/\\/g, '/')).toContain('example-project/docs/development/project.yaml');
  });

  it('пускает к файлу кода: ради этого маршрут и нужен', () => {
    expect(() => resolveInside(root, 'app/src/bite.ts')).not.toThrow();
  });

  it('отказывает на выходе наверх', () => {
    expect(() => resolveInside(root, '../secrets.txt')).toThrow(OutsideRootError);
  });

  it('отказывает, даже если `..` возвращается внутрь: разворачивать его мы не беремся', () => {
    expect(() => resolveInside(root, 'docs/../docs/development/project.yaml')).toThrow(OutsideRootError);
  });

  it('отказывает на абсолютном пути и на пути с буквой диска', () => {
    expect(() => resolveInside(root, '/etc/passwd')).toThrow(OutsideRootError);
    expect(() => resolveInside(root, 'C:/Windows/win.ini')).toThrow(OutsideRootError);
  });

  it('отказывает на обратных слешах, ведущих наружу', () => {
    expect(() => resolveInside(root, '..\\..\\secrets.txt')).toThrow(OutsideRootError);
  });

  it('несуществующий файл — это не нарушение границы', () => {
    expect(() => resolveInside(root, 'app/src/missing.ts')).not.toThrow();
  });

  it('называет в сообщении и путь, и корень: иначе отказ нечем объяснить', () => {
    try {
      resolveInside(root, '../secrets.txt');
      expect.unreachable('должен был отказать');
    } catch (error) {
      expect(error).toBeInstanceOf(OutsideRootError);
      expect((error as OutsideRootError).message).toContain('secrets.txt');
    }
  });
});

describe('toProjectPath', () => {
  it('отдаёт путь относительно корня через прямой слеш', () => {
    const absolute = resolveInside(root, 'docs/development/project.yaml');
    expect(toProjectPath(root, absolute)).toBe('docs/development/project.yaml');
  });
});
