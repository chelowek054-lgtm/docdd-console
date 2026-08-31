import { describe, expect, it } from 'vitest';

import { extractDiagrams } from '../server/lib/diagrams';

describe('extractDiagrams', () => {
  it('находит блок mermaid в тексте', () => {
    const body = '# Заголовок\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\nдальше текст\n';
    const diagrams = extractDiagrams(body);
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0]?.kind).toBe('inline');
    expect(diagrams[0]?.source).toBe('flowchart LR\n  a --> b');
  });

  it('находит несколько блоков и не склеивает их', () => {
    const body = '```mermaid\na\n```\n\ntext\n\n```mermaid\nb\n```\n';
    expect(extractDiagrams(body).map((item) => item.source)).toEqual(['a', 'b']);
  });

  it('не принимает обычный блок кода за диаграмму', () => {
    expect(extractDiagrams('```ts\nconst a = 1;\n```\n')).toEqual([]);
  });

  it('находит вставленный файл .mmd и читает его через переданную функцию', () => {
    const body = '![Потоки данных](../diagrams/dataflow.mmd)\n';
    const diagrams = extractDiagrams(body, () => 'flowchart TB');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0]).toMatchObject({
      kind: 'file',
      path: '../diagrams/dataflow.mmd',
      caption: 'Потоки данных',
      source: 'flowchart TB'
    });
  });

  it('нечитаемая диаграмма — предупреждение у документа, а не отказ его показать', () => {
    const diagrams = extractDiagrams('![Схема](../diagrams/missing.mmd)\n', () => null);
    expect(diagrams[0]?.error).toContain('missing.mmd');
    expect(diagrams).toHaveLength(1);
  });

  it('пустой блок отмечен ошибкой, но документ остаётся с диаграммой в списке', () => {
    const diagrams = extractDiagrams('```mermaid\n\n```\n');
    expect(diagrams[0]?.error).toBe('Пустой блок mermaid');
  });

  it('обычную картинку и ссылку на документ диаграммой не считает', () => {
    expect(extractDiagrams('![Схема](../images/scheme.png)\n[Документ](./D-0001.md)\n')).toEqual([]);
  });
});
