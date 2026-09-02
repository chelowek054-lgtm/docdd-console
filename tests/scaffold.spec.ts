import { describe, expect, it } from 'vitest';

import { checkRow, surveyFile, withFrontMatter } from '../server/lib/import';
import { parseRecord } from '../server/lib/parse';
import { validateFrontMatter, validateProject } from '../server/lib/schema';
import { claudeMd, fileNameFor, gitignoreWithDocdd, manifestYaml, nextId, recordTemplate, slugify } from '../server/lib/scaffold';

/**
 * Заведение и импорт трогают файлы человека сильнее всего: создают, переносят,
 * дописывают заголовок. Поэтому проверяется и то, что получилось, и то, что
 * осталось нетронутым.
 */

const LF = String.fromCharCode(10);

describe('slugify', () => {
  it('транслитерирует кириллицу', () => {
    expect(slugify('Вынести веса модели клёва')).toBe('vynesti-vesa-modeli-kleva');
  });

  it('схлопывает знаки и не оставляет дефис на конце', () => {
    expect(slugify('API: формат обмена, версия 2!')).toBe('api-format-obmena-versiya-2');
  });

  it('заголовок без пригодных букв всё равно даёт имя файла', () => {
    expect(slugify('!!! ???')).toBe('zapis');
  });

  it('обрезает длинный заголовок, не обрывая на дефисе', () => {
    const slug = slugify('Очень длинный заголовок записи, который никак не помещается в имя файла');
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('nextId', () => {
  it('выдаёт следующий за наибольшим занятым', () => {
    expect(nextId('task', ['T-0001', 'T-0007', 'R-0009'])).toBe('T-0008');
  });

  it('дыру не занимает: номера не переиспользуются', () => {
    expect(nextId('task', ['T-0001', 'T-0003'])).toBe('T-0004');
  });

  it('в пустом проекте начинает с первого', () => {
    expect(nextId('requirement', [])).toBe('R-0001');
  });

  it('чужие префиксы не считает своими', () => {
    expect(nextId('verification', ['T-0042'])).toBe('V-0001');
  });
});

describe('recordTemplate', () => {
  it('даёт запись, которая проходит схему', () => {
    for (const type of ['requirement', 'design', 'decision', 'contract', 'task', 'phase', 'verification'] as const) {
      const text = recordTemplate({ id: `${fileNameFor('X', 'x')[0]}`, type, title: 'Заголовок', today: '2026-08-31' });
      const withId = text.replace(/^id: .*$/m, `id: ${prefixOf(type)}-0001`);
      const parsed = parseRecord(withId, { path: `docs/development/${type}.md` });
      expect(parsed.ok, type).toBe(true);
      if (!parsed.ok) continue;
      expect(validateFrontMatter(parsed.record.data), type).toEqual([]);
    }
  });

  it('заголовок в теле совпадает с полем title', () => {
    const text = recordTemplate({ id: 'T-0001', type: 'task', title: 'Новая задача', today: '2026-08-31' });
    expect(text).toContain('title: Новая задача');
    expect(text).toContain('# Новая задача');
  });

  it('задаче пишет links даже пустыми: схема их требует', () => {
    const text = recordTemplate({ id: 'T-0001', type: 'task', title: 'Задача', today: '2026-08-31' });
    expect(text).toContain('links: {}');
  });

  it('пишет `change` у задачи, когда он назван', () => {
    const text = recordTemplate({ id: 'T-0001', type: 'task', title: 'Задача', today: '2026-08-31', change: 'feature' });
    expect(text).toContain('change: feature');
  });

  it('не пишет `change` там, где его нет в схеме', () => {
    const text = recordTemplate({ id: 'D-0001', type: 'design', title: 'Документ', today: '2026-08-31', change: 'feature' });
    expect(text).not.toContain('change:');
  });

  it('заводит запись с журналом', () => {
    const text = recordTemplate({ id: 'R-0001', type: 'requirement', title: 'Требование', today: '2026-08-31' });
    expect(text).toContain('## Журнал');
    expect(text).toContain('- 2026-08-31 · заведена · приложение');
  });
});

function prefixOf(type: string): string {
  return { requirement: 'R', design: 'D', decision: 'A', contract: 'C', task: 'T', phase: 'P', verification: 'V' }[type] ?? 'X';
}

describe('manifestYaml', () => {
  it('даёт манифест, который проходит свою схему', async () => {
    const { load } = await import('js-yaml');
    const text = manifestYaml({ id: 'fishforecast', name: 'FishForecast' });
    expect(validateProject(load(text))).toEqual([]);
  });

  it('объявляет все разделы контракта', () => {
    const text = manifestYaml({ id: 'p', name: 'P' });
    for (const section of ['requirements', 'design', 'decisions', 'contracts', 'tasks', 'phases', 'tests', 'diagrams']) {
      expect(text).toContain(`  ${section}: `);
    }
  });
});

describe('gitignoreWithDocdd', () => {
  it('файла ещё нет — заводит с одной строкой', () => {
    expect(gitignoreWithDocdd(null)).toBe('.docdd/\n');
  });

  it('строка уже есть — файл не трогает', () => {
    const text = '.env\n.docdd/\n';
    expect(gitignoreWithDocdd(text)).toBe(text);
  });

  it('строки нет — дописывает в конец, не теряя остального', () => {
    const text = '.env\n*.log\n';
    const after = gitignoreWithDocdd(text);
    expect(after).toBe('.env\n*.log\n.docdd/\n');
  });

  it('файл без конечного перевода строки — не склеивает строки', () => {
    const after = gitignoreWithDocdd('.env');
    expect(after).toBe('.env\n.docdd/\n');
  });
});

describe('surveyFile', () => {
  it('берёт заголовок из текста', () => {
    const row = surveyFile('app/docs/auth.md', '# Аутентификация\n\nтекст\n');
    expect(row.title).toBe('Аутентификация');
  });

  it('без заголовка берёт имя файла', () => {
    expect(surveyFile('app/docs/bite-model.md', 'просто текст\n').title).toBe('Bite model');
  });

  it('предполагает тип по папке и называет причину', () => {
    expect(surveyFile('app/docs/adr/0001-stack.md', '# Стек\n').suggestedType).toBe('decision');
    expect(surveyFile('app/docs/requirements/offline.md', '# Офлайн\n').suggestedType).toBe('requirement');
    expect(surveyFile('app/docs/adr/0001-stack.md', '# Стек\n').reason).toContain('решени');
  });

  it('не выдумывает тип, когда путь ни о чём не говорит', () => {
    const row = surveyFile('notes/mixed.md', '# Заметка\n');
    expect(row.suggestedType).toBeNull();
    expect(row.reason).toContain('выберите тип сами');
  });

  it('корень импорта подсказкой не считает: папка `docs` есть у всего', () => {
    expect(surveyFile('app/docs/notes.md', '# Заметки\n').suggestedType).toBeNull();
    expect(surveyFile('app/docs/design/bite.md', '# Веса\n').suggestedType).toBe('design');
  });

  it('замечает файл, у которого front matter уже есть', () => {
    expect(surveyFile('a.md', '---\nid: T-0001\n---\n\n# Есть\n').hasFrontMatter).toBe(true);
    expect(surveyFile('a.md', '# Нет\n').hasFrontMatter).toBe(false);
  });
});

describe('withFrontMatter', () => {
  const body = ['# Аутентификация', '', 'Текст, который принадлежит человеку.', ''].join(LF);

  it('добавляет заголовок и не трогает текст', () => {
    const next = withFrontMatter(body, { id: 'D-0001', type: 'design', title: 'Аутентификация', today: '2026-08-31' });
    expect(next.endsWith(body)).toBe(true);
    expect(next).toContain('id: D-0001');
  });

  it('получается запись, проходящая схему', () => {
    const next = withFrontMatter(body, { id: 'D-0001', type: 'design', title: 'Аутентификация', today: '2026-08-31' });
    const parsed = parseRecord(next, { path: 'docs/development/design/D-0001-a.md' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(validateFrontMatter(parsed.record.data)).toEqual([]);
  });

  it('сохраняет CRLF: чужой файл не должен получить дифф на все строки', () => {
    const crlf = body.replace(/\n/g, '\r\n');
    const next = withFrontMatter(crlf, { id: 'D-0001', type: 'design', title: 'А', today: '2026-08-31' });
    expect(next.endsWith(crlf)).toBe(true);
    expect(next.split('\r\n').length).toBeGreaterThan(next.split(/(?<!\r)\n/).length);
  });
});

describe('checkRow', () => {
  it('пропускает годную строку плана', () => {
    expect(checkRow({ path: 'a.md', type: 'design', title: 'Заголовок' }, '# Заголовок\n')).toBeNull();
  });

  it('не даёт импортировать то, что уже запись', () => {
    const problem = checkRow({ path: 'a.md', type: 'design', title: 'A' }, '---\nid: D-0001\n---\n');
    expect(problem).toContain('front matter');
  });

  it('не даёт незнакомый тип и пустой заголовок', () => {
    expect(checkRow({ path: 'a.md', type: 'adr', title: 'A' }, '# A\n')).toContain('не из списка');
    expect(checkRow({ path: 'a.md', type: 'design', title: '  ' }, '# A\n')).toContain('заголовок');
  });
});

describe('CLAUDE.md', () => {
  const rules = claudeMd({ id: 'fishforecast', name: 'FishForecast' });

  it('назван именем проекта: файл кладётся в чужой корень, и понятно, чей он', () => {
    expect(rules.startsWith('# FishForecast: правила работы')).toBe(true);
  });

  it('несёт главное правило целиком, а не ссылку на него', () => {
    // Модель читает этот файл в проекте, где никакой другой документации о
    // процессе может не быть.
    expect(rules).toContain('пока правка документации не подтверждена');
    expect(rules).toContain('Молчание подтверждением не');
  });

  it('называет все типы записей с префиксами', () => {
    for (const prefix of ['`R-`', '`D-`', '`A-`', '`C-`', '`T-`', '`P-`', '`V-`', '`M-`']) {
      expect(rules, prefix).toContain(prefix);
    }
  });

  it('запрещает подтверждать за человека — иначе правило станет украшением', () => {
    expect(rules).toContain('Не подтверждать документы за человека');
    expect(rules).toContain('approved');
  });

  it('требует свидетельства под утверждением', () => {
    expect(rules).toContain('свидетельств');
    expect(rules).toContain('путь, номер, фрагмент');
  });

  it('не описывает устройство проекта: оно живёт в картах и меняется', () => {
    expect(rules).not.toContain('sources.code');
    expect(rules).not.toContain('npm run');
  });
});

describe('CLAUDE.md про входящее', () => {
  const rules = claudeMd({ id: 'demo', name: 'Demo' });

  it('называет склад поимённо: иначе модель не знает, куда класть', () => {
    expect(rules).toContain('docs/inbox');
    expect(rules).toContain('Один файл — одна тема');
  });

  it('берёт склад из манифеста, а не зашивает свой', () => {
    expect(claudeMd({ id: 'demo', name: 'Demo', inbox: 'notes' })).toContain('`notes`');
  });

  it('запрещает выдумывать номера и писать front matter в заметке', () => {
    expect(rules).toContain('Не выдумывай номера');
    expect(rules).toContain('не пиши front matter');
  });

  it('объясняет, что дальше: разбирает человек через приложение', () => {
    // Без этого модель попробует завести записи сама и займёт чужие номера.
    expect(rules).toContain('Разобрать входящее');
    expect(rules).toContain('не заводи записи сам');
  });
});

describe('манифест про входящее', () => {
  it('заготовка сразу называет склад: иначе экран входящего пуст без причины', () => {
    expect(manifestYaml({ id: 'demo', name: 'Demo' })).toContain('inbox: [docs/inbox]');
  });
});
