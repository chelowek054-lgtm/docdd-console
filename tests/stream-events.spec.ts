import { describe, expect, it } from 'vitest';

import { createStreamParser, type ModelEvent } from '../server/lib/stream-events';
import { add, type StreamLine } from '../app/utils/event-stream';

/**
 * Разбор ленты Claude Code (docs/04-ui.md, раздел «Что модель делает прямо
 * сейчас»). Формат задан не нами, поэтому здесь же проверяется главное: чего
 * разбор не знает, то он пропускает, а не роняет запрос.
 */

const LF = String.fromCharCode(10);

function events(lines: string[]): ModelEvent[] {
  const parser = createStreamParser();
  const found: ModelEvent[] = [];
  for (const line of lines) found.push(...parser.push(line + LF));
  found.push(...parser.finish());
  return found;
}

const delta = (text: string) =>
  JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });

describe('разбор ленты', () => {
  it('текст ответа идёт кусками, как он пишется', () => {
    expect(events([delta('Раз'), delta('два')])).toEqual([
      { kind: 'text', text: 'Раз' },
      { kind: 'text', text: 'два' }
    ]);
  });

  it('обращение к файлу названо путём, а не JSON', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'server/lib/parse.ts' } }] }
    });
    expect(events([line])).toEqual([{ kind: 'action', text: 'Read: server/lib/parse.ts' }]);
  });

  it('обращение к команде названо командой', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm run test' } }] }
    });
    expect(events([line])).toEqual([{ kind: 'action', text: 'Bash: npm run test' }]);
  });

  it('от ответа средства берётся первая строка, а не полотно', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', content: `12 проверок прошли${LF}подробности${LF}ещё` }] }
    });
    expect(events([line])).toEqual([{ kind: 'result', text: '12 проверок прошли', failed: false }]);
  });

  it('неудача средства видна как неудача', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', content: 'файла нет', is_error: true }] }
    });
    expect(events([line])).toEqual([{ kind: 'result', text: 'файла нет', failed: true }]);
  });

  it('готовый ответ приходит отдельным событием', () => {
    const line = JSON.stringify({ type: 'result', subtype: 'success', result: 'Вот что вышло.' });
    expect(events([line])).toEqual([{ kind: 'answer', text: 'Вот что вышло.' }]);
  });

  it('целый текст не удваивает уже пришедший кусками', () => {
    const whole = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Раздва' }] } });
    // Куски пришли — значит текст уже показан, второй раз он не нужен.
    expect(events([delta('Раз'), delta('два'), whole])).toEqual([
      { kind: 'text', text: 'Раз' },
      { kind: 'text', text: 'два' }
    ]);
  });

  it('без кусков берётся целый текст: лента не должна остаться пустой', () => {
    const whole = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Ответ' }] } });
    expect(events([whole])).toEqual([{ kind: 'text', text: 'Ответ' }]);
  });

  it('незнакомое событие пропускается, а не роняет разбор', () => {
    const unknown = JSON.stringify({ type: 'system', subtype: 'init', tools: ['Read'] });
    expect(events([unknown, delta('дальше')])).toEqual([{ kind: 'text', text: 'дальше' }]);
  });

  it('не-JSON в ленте не мешает: программа могла написать своё', () => {
    expect(events(['Warning: что-то', delta('ответ')])).toEqual([{ kind: 'text', text: 'ответ' }]);
  });

  it('строка, разорванная между кусками, собирается обратно', () => {
    const parser = createStreamParser();
    const whole = delta('целое') + LF;
    const found = [...parser.push(whole.slice(0, 20)), ...parser.push(whole.slice(20)), ...parser.finish()];
    expect(found).toEqual([{ kind: 'text', text: 'целое' }]);
  });

  it('последняя строка без переноса не теряется', () => {
    const parser = createStreamParser();
    expect([...parser.push(delta('хвост')), ...parser.finish()]).toEqual([{ kind: 'text', text: 'хвост' }]);
  });
});

describe('складывание ленты для экрана', () => {
  it('куски текста склеиваются в одну строку, а не сыплются обрывками', () => {
    const lines: StreamLine[] = [];
    add(lines, 'text', { kind: 'text', text: 'Раз' });
    add(lines, 'text', { kind: 'text', text: ' два' });
    expect(lines).toEqual([{ kind: 'text', text: 'Раз два' }]);
  });

  it('обращение прерывает текст: это отдельный шаг', () => {
    const lines: StreamLine[] = [];
    add(lines, 'text', { kind: 'text', text: 'думаю' });
    add(lines, 'action', { kind: 'action', text: 'Read: a.ts' });
    add(lines, 'text', { kind: 'text', text: 'дальше' });
    expect(lines.map((line) => line.kind)).toEqual(['text', 'action', 'text']);
  });

  it('пустое и незнакомое в ленту не попадает', () => {
    const lines: StreamLine[] = [];
    add(lines, 'text', { kind: 'text', text: '' });
    add(lines, 'done', { kind: 'text', text: 'не строка ленты' });
    expect(lines).toEqual([]);
  });
});
