<script setup lang="ts">
import MarkdownIt from 'markdown-it';

const props = defineProps<{ body: string }>();

/**
 * Разметка документа. Блоки mermaid вырезаются и отдаются отрисовщику: внутри
 * markdown-it они остались бы текстом в рамке.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

interface Piece {
  kind: 'markdown' | 'mermaid';
  content: string;
}

const pieces = computed<Piece[]>(() => {
  const result: Piece[] = [];
  const pattern = /^[ \t]*(?:```|~~~)[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)^[ \t]*(?:```|~~~)[ \t]*$/gm;
  let at = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(props.body)) !== null) {
    const before = props.body.slice(at, match.index);
    if (before.trim()) result.push({ kind: 'markdown', content: before });
    result.push({ kind: 'mermaid', content: (match[1] ?? '').trim() });
    at = match.index + match[0].length;
  }

  const rest = props.body.slice(at);
  if (rest.trim()) result.push({ kind: 'markdown', content: rest });
  return result;
});
</script>

<template>
  <div class="space-y-4">
    <template v-for="(piece, at) in pieces" :key="at">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="piece.kind === 'markdown'" class="docdd-prose" v-html="md.render(piece.content)" />
      <MermaidDiagram v-else :source="piece.content" :id="`body-${at}`" />
    </template>
  </div>
</template>

<style scoped>
/*
 * Разметка минимальная: документ читают, а не любуются им. Стили — токенами
 * Nuxt UI, чтобы тёмная тема работала сама.
 */
.docdd-prose :deep(h1),
.docdd-prose :deep(h2),
.docdd-prose :deep(h3) {
  font-weight: 600;
  margin: 1.2em 0 0.5em;
}
.docdd-prose :deep(h1) { font-size: 1.25rem; }
.docdd-prose :deep(h2) { font-size: 1.1rem; }
.docdd-prose :deep(p),
.docdd-prose :deep(ul),
.docdd-prose :deep(ol) { margin: 0.6em 0; }
.docdd-prose :deep(ul) { list-style: disc; padding-left: 1.4em; }
.docdd-prose :deep(ol) { list-style: decimal; padding-left: 1.4em; }
.docdd-prose :deep(code) {
  background: var(--ui-bg-elevated);
  border-radius: 4px;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}
.docdd-prose :deep(pre) {
  background: var(--ui-bg-elevated);
  border-radius: 6px;
  padding: 0.8em;
  overflow-x: auto;
}
.docdd-prose :deep(pre code) { background: none; padding: 0; }
.docdd-prose :deep(table) { width: 100%; border-collapse: collapse; }
.docdd-prose :deep(th),
.docdd-prose :deep(td) {
  border: 1px solid var(--ui-border);
  padding: 0.4em 0.6em;
  text-align: left;
}
.docdd-prose :deep(a) { text-decoration: underline; }
.docdd-prose :deep(blockquote) {
  border-left: 3px solid var(--ui-border);
  padding-left: 0.8em;
  color: var(--ui-text-muted);
}
</style>
