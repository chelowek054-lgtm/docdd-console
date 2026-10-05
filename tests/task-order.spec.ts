import { describe, expect, it } from 'vitest';

import { lacksRequirement, requirementChoices, unapprovedRequirements, withImplements } from '../server/lib/task-order';

/** Привести задачу в порядок (docs/04-ui.md, «Запись»): выбор требования для `implements`. */

const records = [
  { id: 'R-0003', type: 'requirement', title: 'Экспорт данных', status: 'draft' },
  { id: 'R-0001', type: 'requirement', title: 'Вход по паролю', status: 'approved' },
  { id: 'R-0002', type: 'requirement', title: 'Архитектура соответствует правилам', status: 'approved' },
  { id: 'R-0004', type: 'requirement', title: 'Старое', status: 'superseded' },
  { id: 'D-0001', type: 'design', title: 'Вход по паролю: дизайн', status: 'approved' }
];

describe('требования для выбора', () => {
  it('подтверждённые первыми, отставленные и не-требования не предлагаются', () => {
    expect(requirementChoices(records, '').map((item) => item.id)).toEqual(['R-0001', 'R-0002', 'R-0003']);
  });

  it('поиск по номеру и названию без учёта регистра', () => {
    expect(requirementChoices(records, 'r-0003').map((item) => item.id)).toEqual(['R-0003']);
    expect(requirementChoices(records, 'ВХОД').map((item) => item.id)).toEqual(['R-0001']);
    expect(requirementChoices(records, 'нет такого')).toEqual([]);
  });

  it('больше предела не показывает', () => {
    const many = Array.from({ length: 20 }, (_, at) => ({ id: `R-${String(at + 1).padStart(4, '0')}`, type: 'requirement', title: 'x', status: 'approved' }));
    expect(requirementChoices(many, '')).toHaveLength(8);
    expect(requirementChoices(many, '', 3)).toHaveLength(3);
  });
});

describe('связи с новым implements', () => {
  it('прежние связи уходят вместе с новой: правка полей заменяет links целиком', () => {
    expect(withImplements({ affects: ['M-0004'] } as never, 'R-0001')).toEqual({ affects: ['M-0004'], implements: ['R-0001'] });
  });

  it('второе требование дописывается, повтор не задваивается', () => {
    expect(withImplements({ implements: ['R-0001'] }, 'R-0002').implements).toEqual(['R-0001', 'R-0002']);
    expect(withImplements({ implements: ['R-0001'] }, 'R-0001').implements).toEqual(['R-0001']);
  });

  it('исходный объект не меняется', () => {
    const links = { implements: ['R-0001'] };
    withImplements(links, 'R-0002');
    expect(links.implements).toEqual(['R-0001']);
  });
});

describe('что мешает задаче', () => {
  it('неподтверждённые требования называются, неизвестные и подтверждённые — нет', () => {
    const status = (id: string) => records.find((item) => item.id === id)?.status;
    expect(unapprovedRequirements({ implements: ['R-0001', 'R-0003', 'R-9999'] }, status)).toEqual(['R-0003']);
    expect(unapprovedRequirements({}, status)).toEqual([]);
  });

  it('форма нужна только когда шаг блокирует отсутствие implements', () => {
    expect(lacksRequirement([{ blockers: [{ code: 'task_no_requirement' }] }])).toBe(true);
    expect(lacksRequirement([{ blockers: [{ code: 'task_not_ready_docs' }] }, { blockers: [] }])).toBe(false);
    expect(lacksRequirement([])).toBe(false);
  });
});
