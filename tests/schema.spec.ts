import { describe, expect, it } from 'vitest';

import { validateFrontMatter, validateProject, validateReport } from '../server/lib/schema';

const task = {
  id: 'T-0007',
  type: 'task',
  title: 'Вынести веса модели клёва',
  status: 'ready',
  created: '2026-08-30',
  updated: '2026-08-30',
  links: { implements: ['R-0004'] }
};

describe('validateFrontMatter', () => {
  it('молчит на годной записи, включая незнакомое поле', () => {
    expect(validateFrontMatter({ ...task, своё_поле: 'значение' })).toEqual([]);
  });

  it('называет недостающее обязательное поле', () => {
    const issues = validateFrontMatter({ ...task, updated: undefined });
    expect(issues.map((issue) => issue.message)).toContain('Не хватает обязательного поля `updated`.');
  });

  it('называет недопустимый статус задачи', () => {
    const issues = validateFrontMatter({ ...task, status: 'в работе' });
    expect(issues.some((issue) => issue.instancePath === '/status')).toBe(true);
    expect(issues.some((issue) => issue.message.includes('`in_progress`'))).toBe(true);
  });

  it('ловит дату, не приведённую к строке', () => {
    const issues = validateFrontMatter({ ...task, created: new Date('2026-08-30T00:00:00Z') });
    expect(issues.some((issue) => issue.instancePath === '/created')).toBe(true);
  });

  it('ловит незнакомую связь: список связей закрыт контрактом', () => {
    const issues = validateFrontMatter({ ...task, links: { blocks: ['T-0001'] } });
    expect(issues.some((issue) => issue.message.includes('blocks'))).toBe(true);
  });

  it('задача обязана иметь links', () => {
    const { links: _links, ...withoutLinks } = task;
    const issues = validateFrontMatter(withoutLinks);
    expect(issues.map((issue) => issue.message)).toContain('Не хватает обязательного поля `links`.');
  });

  it('проверка обязана назвать вид', () => {
    const issues = validateFrontMatter({
      id: 'V-0004', type: 'verification', title: 'Прогон', status: 'approved',
      created: '2026-08-30', updated: '2026-08-30'
    });
    expect(issues.map((issue) => issue.message)).toContain('Не хватает обязательного поля `kind`.');
  });
});

const manifest = {
  contract: 'docdd.workspace/1',
  project: { id: 'fishforecast', name: 'FishForecast' },
  paths: { requirements: 'requirements', tasks: 'tasks' }
};

describe('validateProject', () => {
  it('молчит на годном манифесте', () => {
    expect(validateProject(manifest)).toEqual([]);
  });

  it('отвергает чужое поколение контракта целиком и с причиной', () => {
    const issues = validateProject({ ...manifest, contract: 'docdd.workspace/2' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('docdd.workspace/2');
    expect(issues[0]?.message).toContain('миграция');
  });

  it('отсутствующий раздел в paths — не ошибка', () => {
    expect(validateProject({ ...manifest, paths: {} })).toEqual([]);
  });

  it('ловит незнакомый раздел в paths', () => {
    const issues = validateProject({ ...manifest, paths: { ideas: 'ideas' } });
    expect(issues.some((issue) => issue.message.includes('ideas'))).toBe(true);
  });
});

const report = {
  contract: 'docdd.workspace/1',
  runner: 'gradle',
  started_at: '2026-08-30T10:00:00Z',
  total: 161,
  failed: 0,
  verifications: { 'V-0004': 'passed', 'V-0007': 'failed' }
};

describe('validateReport', () => {
  it('молчит на годном отчёте', () => {
    expect(validateReport(report)).toEqual([]);
  });

  it('ловит результат, которого нет в контракте', () => {
    const issues = validateReport({ ...report, verifications: { 'V-0004': 'зелёный' } });
    expect(issues.some((issue) => issue.instancePath === '/verifications/V-0004')).toBe(true);
  });

  it('ловит ключ, не похожий на идентификатор проверки', () => {
    const issues = validateReport({ ...report, verifications: { test_bite: 'passed' } });
    expect(issues.length).toBeGreaterThan(0);
  });
});
