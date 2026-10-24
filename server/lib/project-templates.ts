import { ROLE_MAP_TEMPLATES } from './role-maps';
import type { CustomMapDefinition } from './types';
import { yamlSafe } from './write';

/**
 * Шаблоны проекта (R-0090): данные, а не движок. Шаблон называет контуры —
 * возможности первого уровня функциональной карты, — заготовки своих карт по
 * ролям и роли команды. Типы записей, статусы, переходы и правила он не
 * меняет: контракт `docdd.workspace/1` один для всех.
 */

export interface TemplateCapability {
  id: string;
  title: string;
  summary: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  summary: string;
  /** Контуры проекта: возможности верхнего уровня. */
  contours: readonly TemplateCapability[];
  /** Заготовки своих карт (определения для `maps.custom`). */
  customMaps: readonly CustomMapDefinition[];
}

export const SOFTWARE_CORE: ProjectTemplate = {
  id: 'software-core',
  name: 'Веб, бэкенд, фулстек',
  summary: 'Классическая разработка ПО: от требований до выпуска и поддержки.',
  contours: [
    { id: 'product', title: 'Продукт и требования', summary: 'Что строим и для кого: требования, приоритеты, критерии готовности.' },
    { id: 'architecture', title: 'Архитектура и код', summary: 'Устройство системы: модули, контракты, данные, решения.' },
    { id: 'interface', title: 'Интерфейс и дизайн', summary: 'Пути пользователя, экраны, дизайн-система.' },
    { id: 'infrastructure', title: 'Инфраструктура и выкладка', summary: 'Окружения, сборка, выкладка, мониторинг.' },
    { id: 'quality', title: 'Качество и безопасность', summary: 'Проверки, тесты, дефекты, уязвимости.' },
    { id: 'release', title: 'Выпуск и поддержка', summary: 'Релизы, документация для пользователей, сопровождение.' }
  ],
  customMaps: ROLE_MAP_TEMPLATES.map((item) => item.definition)
};

/** Шаблоны по идентификатору; следующие (`gamedev`, `llm-product`) добавляются сюда же. */
export const PROJECT_TEMPLATES: Readonly<Record<string, ProjectTemplate>> = { [SOFTWARE_CORE.id]: SOFTWARE_CORE };

export function projectTemplate(id: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES[id] ?? null;
}

/** Секция `maps.custom` манифеста текстом: человек будет её читать и править. */
export function customMapsYaml(definitions: readonly CustomMapDefinition[]): string[] {
  const lines = ['maps:', '  custom:'];
  for (const def of definitions) {
    lines.push(
      `    - id: ${def.id}`,
      `      title: ${yamlSafe(def.title)}`,
      ...(def.summary ? [`      summary: ${yamlSafe(def.summary)}`] : []),
      `      node: { label: ${yamlSafe(def.node.label)}, plural: ${yamlSafe(def.node.plural)} }`,
      '      relations:',
      ...def.relations.map((item) => `        - { id: ${item.id}, label: ${yamlSafe(item.label)}, style: ${item.style} }`),
      `      features: [${def.features.join(', ')}]`
    );
  }
  return lines;
}

/** Контуры шаблона — возможности для блока `docdd-functional` черновика карты. */
export function contourCapabilities(template: ProjectTemplate): { id: string; title: string; summary: string; priority: string; horizon: string }[] {
  return template.contours.map((item) => ({ ...item, priority: 'must', horizon: 'now' }));
}
