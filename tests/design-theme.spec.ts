import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../server/lib/design';
import { suggestForeground, themeBlockText, themeContrast, themeProblems, themeResolved, type ThemeDraft } from '../server/lib/design-theme';
import { FIELD_TYPES, constructorProblems, generateForm, generateTable } from '../server/lib/design-constructors';
import { designTokens, locales } from '../app/design-tokens';

/** R-0035 / V-0035: конструктор тем, конструкторы форм и таблиц, токены самой консоли. */

const BASE = { bg: '#FFFFFF', ink: '#111111', muted: '#555555', accent: '#0A5BD8', onAccent: '#FFFFFF' };
const draft = (over: Partial<ThemeDraft> = {}): ThemeDraft => ({
  name: 'ocean', label: 'Океан', mode: 'light', minContrast: null, overrides: { accent: '#00557F' }, ...over
});

describe('конструктор тем', () => {
  it('принимает хорошее имя и отказывает по причинам', () => {
    expect(themeProblems(draft(), [])).toEqual([]);
    expect(themeProblems(draft({ name: 'Bad Name' }), [])).toContain('name');
    expect(themeProblems(draft({ name: 'dark' }), [])).toContain('reserved');
    expect(themeProblems(draft(), ['ocean'])).toContain('taken');
    expect(themeProblems(draft({ overrides: {} }), [])).toContain('empty');
  });

  it('палитра: база и поверх неё переопределённое', () => {
    expect(themeResolved(BASE, draft())).toMatchObject({ bg: '#FFFFFF', accent: '#00557F' });
  });

  it('блок содержит только изменённые роли и разбирается как JSON', () => {
    const text = themeBlockText(BASE, draft({ overrides: { accent: '#00557F', bg: '#FFFFFF' } }));
    expect(text.startsWith('```docdd-design\n')).toBe(true);
    const json = JSON.parse(text.split('\n').slice(1, -1).join('\n'));
    expect(json.themes.ocean.palette).toEqual({ accent: '#00557F' });
    expect(json.themes.ocean.mode).toBe('light');
    expect(json.themes.ocean.minContrast).toBeUndefined();
  });

  it('контраст считается по правилам проверки токенов', () => {
    const weak = themeContrast(BASE, draft({ overrides: { ink: '#EEEEEE' } }));
    expect(weak.length).toBeGreaterThan(0);
    expect(weak.some((row) => !row.ok)).toBe(true);
  });

  it('подсказка цвета доводит контраст до порога', () => {
    const fixed = suggestForeground('#BBBBBB', '#FFFFFF', 4.5);
    expect(contrastRatio(fixed, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(suggestForeground('#111111', '#FFFFFF', 4.5)).toBe('#111111');
    const onDark = suggestForeground('#444444', '#000000', 4.5);
    expect(contrastRatio(onDark, '#000000')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('конструкторы форм и таблиц', () => {
  const stacks = ['nuxt-ui', 'expo', 'compose', 'swiftui'] as const;
  const form = { name: 'profile', fields: [{ id: 'firstName', type: 'text' as const, required: true }, { id: 'agree', type: 'checkbox' as const, required: false }] };

  it('опасные и пустые имена не проходят', () => {
    expect(constructorProblems('profile', ['a'])).toEqual([]);
    expect(constructorProblems('../x', ['a'])).toContain('name');
    expect(constructorProblems('p', [])).toContain('empty');
    expect(constructorProblems('p', ['a b'])).toContain('id:a b');
    expect(constructorProblems('p', ['a', 'a'])).toContain('duplicate');
  });

  it('форма: файл на каждый стек и словарь на каждый язык, русский пуст для перевода', () => {
    for (const stack of stacks) {
      const out = generateForm(stack, form, ['ru', 'en']);
      expect(out.files.length).toBeGreaterThanOrEqual(3);
      expect(Object.keys(out.dictionaries)).toEqual(['ru', 'en']);
      expect(JSON.stringify(out.dictionaries['ru']).match(/:"[^"]+"/g)).toBeNull();
      expect(JSON.stringify(out.dictionaries['en'])).toContain('First name');
      for (const file of out.files) expect(file.path).not.toContain('..');
    }
  });

  it('таблица: колонки попадают в код и словарь; без языков словарей нет', () => {
    const spec = { name: 'users', columns: [{ id: 'email', sortable: true }] };
    for (const stack of stacks) {
      const out = generateTable(stack, spec, ['en']);
      expect(out.files.some((file) => file.content.includes('email'))).toBe(true);
      expect(out.dictionaries['en']).toBeTruthy();
      expect(generateTable(stack, spec, []).dictionaries).toEqual({});
    }
  });

  it('типы полей перечислены', () => expect(FIELD_TYPES).toContain('select'));
});

describe('токены самой консоли', () => {
  it('размеры в rem, языки ru и en', () => {
    expect(designTokens.unit).toBe('rem');
    expect(locales).toEqual(expect.arrayContaining(['ru', 'en']));
    expect(designTokens.spacing.lg).toBe(1);
  });
});
