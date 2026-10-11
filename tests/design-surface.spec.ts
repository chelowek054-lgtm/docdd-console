import { describe, expect, it } from 'vitest';

import { resolveDesign, plainTokens } from '../server/lib/design';
import { backdropValue, capsClasses, elevationValue, parseSurface, surfaceVariables } from '../server/lib/design-surface';

/**
 * Поверхности и вид (docs/16-design-system.md, «Поверхности и вид»): тени, подложка,
 * мягкая заливка и подписи капсом приходят незнакомыми ключами блока и переводятся в
 * переменные CSS.
 */

const GOOD = {
  elevation: { card: [{ y: 0.0625, blur: 0.125, alpha: 0.05 }, { y: 0.625, blur: 1.75, alpha: 0.06 }] },
  backdrop: { page: [{ x: 0, y: 0, w: 60, h: 24, color: 'accent', alpha: 0.12 }] },
  tint: { soft: 0.12 },
  caps: { kicker: 0.08 }
};

describe('поверхности и вид', () => {
  it('разбирает тени, подложку, заливку и подписи капсом', () => {
    const { surface, problems } = parseSurface(GOOD);
    expect(problems).toEqual([]);
    expect(surface.elevation['card']).toHaveLength(2);
    expect(surface.backdrop['page']?.[0]).toMatchObject({ color: 'accent', alpha: 0.12 });
    expect(surface.tint['soft']).toBe(0.12);
    expect(surface.caps['kicker']).toBe(0.08);
  });

  it('негодное называет и не роняет остальное', () => {
    const { surface, problems } = parseSurface({
      ...GOOD,
      elevation: { card: [{ y: 1, alpha: 0.5 }] },
      tint: { soft: 2 },
      caps: { kicker: 0.08 }
    });
    expect(problems.join('\n')).toContain('elevation.card');
    expect(problems.join('\n')).toContain('tint.soft');
    expect(surface.elevation).toEqual({});
    expect(surface.caps['kicker']).toBe(0.08);
  });

  it('переводит слои в CSS через color-mix от переменных ролей — темы переключают их сами', () => {
    const { surface } = parseSurface(GOOD);
    expect(elevationValue(surface.elevation['card']!)).toBe(
      '0rem 0.0625rem 0.125rem 0rem color-mix(in srgb, var(--ds-color-shadow) 5%, transparent), '
      + '0rem 0.625rem 1.75rem 0rem color-mix(in srgb, var(--ds-color-shadow) 6%, transparent)'
    );
    expect(backdropValue(surface.backdrop['page']!)).toBe(
      'radial-gradient(60% 24% at 0% 0%, color-mix(in srgb, var(--ds-color-accent) 12%, transparent), transparent)'
    );
    expect(surfaceVariables(surface)).toEqual([
      expect.stringContaining('--ds-shadow-card: 0rem'),
      expect.stringContaining('--ds-backdrop-page: radial-gradient'),
      '  --ds-tint-soft: 12%;',
      '  --ds-tracking-kicker: 0.08em;'
    ]);
    expect(capsClasses(surface).join('\n')).toContain('text-transform: uppercase;');
  });

  it('проходит сложение блока: приходит из незнакомых ключей, а плоские токены остаются', () => {
    const body = '```docdd-design\n' + JSON.stringify({ unit: 'rem', radius: { lg: 1 }, ...GOOD }) + '\n```';
    const resolution = resolveDesign({ general: [{ id: 'D-0002', body }], local: [] });
    const plain = plainTokens(resolution.tokens);
    expect(plain.radius['lg']).toBe(1);
    expect(plain.surface.elevation['card']).toHaveLength(2);
    expect(resolution.problems).toEqual([]);
  });

  it('негодный ключ поверхности виден в problems сложения', () => {
    const body = '```docdd-design\n' + JSON.stringify({ unit: 'rem', caps: { kicker: 5 } }) + '\n```';
    const resolution = resolveDesign({ general: [{ id: 'D-0002', body }], local: [] });
    expect(resolution.problems.map((problem) => problem.message).join('\n')).toContain('caps.kicker');
  });
});
