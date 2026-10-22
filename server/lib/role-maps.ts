import type { CustomMapDefinition, CustomRelationStyle } from './types';

/**
 * Заготовки своих карт под роли (R-0087, docs/adr/0028-custom-maps.md): кнопка
 * «Новая карта» предлагает их как отправную точку, дальше определение правится
 * как любое другое. Чистые данные: заготовка — это определение, а не движок.
 */

const REL: Record<CustomRelationStyle, string> = {
  depends: 'зависит от',
  uses: 'пользуется',
  feeds: 'передаёт данные',
  triggers: 'запускает',
  replaces: 'заменяет'
};

const rels = (...styles: CustomRelationStyle[]) => styles.map((style) => ({ id: style, label: REL[style], style }));

export interface RoleMapTemplate {
  /** Роль, для которой заготовка: `designer`, `devops`, `architect`, `developer`. */
  role: string;
  /** Короткое название на кнопке. */
  name: string;
  definition: CustomMapDefinition;
}

export const ROLE_MAP_TEMPLATES: readonly RoleMapTemplate[] = [
  {
    role: 'designer',
    name: 'Путь пользователя (план)',
    definition: {
      id: 'user-journey-plan',
      title: 'Путь пользователя: как должно быть',
      summary: 'Желаемый путь целиком: шаги, экраны и переходы. Реализованное по коду наложится поверх — карта пользовательских путей.',
      node: { label: 'Шаг', plural: 'Шаги' },
      relations: rels('triggers', 'depends', 'uses'),
      features: ['status', 'priority', 'links']
    }
  },
  {
    role: 'devops',
    name: 'Инфраструктура',
    definition: {
      id: 'infrastructure',
      title: 'Инфраструктура',
      summary: 'Окружения, сервисы, хранилища, сети и их связи с релизами.',
      node: { label: 'Компонент', plural: 'Компоненты' },
      relations: rels('depends', 'feeds', 'uses', 'triggers'),
      features: ['status', 'horizon', 'links']
    }
  },
  {
    role: 'architect',
    name: 'Модули: входы и выходы',
    definition: {
      id: 'module-io',
      title: 'Модули: входы и выходы',
      summary: 'Блоки системы с тем, что каждый принимает и выдаёт; выход одного — вход другого.',
      node: { label: 'Блок', plural: 'Блоки' },
      relations: rels('feeds', 'depends', 'uses', 'replaces'),
      features: ['status', 'priority', 'links']
    }
  },
  {
    role: 'developer',
    name: 'Компоненты модуля',
    definition: {
      id: 'module-components',
      title: 'Компоненты модуля: фронтенд и бэкенд',
      summary: 'Взаимосвязь компонентов внутри одного модуля — клиентской и серверной частей; затем общая карта взаимодействия модулей.',
      node: { label: 'Компонент', plural: 'Компоненты' },
      relations: rels('uses', 'depends', 'feeds', 'triggers'),
      features: ['status', 'evidence', 'links']
    }
  }
];

/** Заготовка по роли; нет такой — `null`. */
export function roleMapTemplate(role: string): RoleMapTemplate | null {
  return ROLE_MAP_TEMPLATES.find((item) => item.role === role) ?? null;
}
