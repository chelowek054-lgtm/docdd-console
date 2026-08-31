/**
 * Шаблоны запросов лежат в репозитории и подставляются в сборку через `?raw`
 * (docs/prompts/README.md). Типов у этого импорта нет — объявляем их.
 */
declare module '*.md?raw' {
  const content: string;
  export default content;
}
