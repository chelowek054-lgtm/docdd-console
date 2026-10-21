// V-0010 (R-0010): очередь запросов на сервере — предел параллельности, отмена, отказы.
import { describe, expect, it } from 'vitest';

import { LlmQueue } from '../server/lib/llm-queue';

const gate = () => { let open!: () => void; const p = new Promise<void>((r) => { open = r; }); return { p, open }; };
const meta = { projectId: 'p', user: 'u', kind: 'k' };
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('очередь запросов к модели', () => {
  it('не больше limit одновременно; остальные ждут и стартуют по мере освобождения', async () => {
    const q = new LlmQueue(2);
    const gates = [gate(), gate(), gate()];
    const jobs = gates.map((g) => q.enqueue(meta, async () => { await g.p; return { ok: true }; }));
    await tick();
    expect(q.list().map((j) => j.state)).toEqual(['running', 'running', 'queued']);
    gates[0]!.open(); await tick();
    expect(q.get(jobs[0]!.id)!.state).toBe('done');
    expect(q.get(jobs[2]!.id)!.state).toBe('running');
    gates[1]!.open(); gates[2]!.open(); await tick();
    expect(q.list().every((j) => j.state === 'done')).toBe(true);
  });

  it('отмена ожидающего — сразу, идущего — сигналом; неизвестный id и законченное — false', async () => {
    const q = new LlmQueue(1);
    const g = gate();
    const a = q.enqueue(meta, (signal) => new Promise((res) => signal.addEventListener('abort', () => res({ ok: true }))));
    const b = q.enqueue(meta, async () => { await g.p; return { ok: true }; });
    await tick();
    expect(q.cancel(b.id)).toBe(true);
    expect(q.get(b.id)!.state).toBe('cancelled');
    expect(q.cancel(a.id)).toBe(true);
    await tick();
    expect(q.get(a.id)!.state).toBe('cancelled');
    expect(q.cancel('нет')).toBe(false);
    expect(q.cancel(a.id)).toBe(false);
    g.open();
  });

  it('исключение в работе — failed с причиной, очередь идёт дальше; список фильтруется по проекту', async () => {
    const q = new LlmQueue(1);
    const bad = q.enqueue(meta, async () => { throw new Error('сбой'); });
    const good = q.enqueue({ ...meta, projectId: 'other' }, async () => ({ ok: true }));
    await tick();
    expect(q.get(bad.id)).toMatchObject({ state: 'failed', note: 'сбой' });
    expect(q.get(good.id)!.state).toBe('done');
    expect(q.list('p').map((j) => j.id)).toEqual([bad.id]);
  });

  it('наружу отдаются копии: правка снаружи не портит задание', () => {
    const q = new LlmQueue(1);
    const j = q.enqueue(meta, async () => { await new Promise(() => {}); return { ok: true }; });
    j.state = 'done';
    expect(q.get(j.id)!.state).toBe('running');
  });

  it('старые законченные забываются сверх предела', async () => {
    const q = new LlmQueue(1, 2);
    for (let i = 0; i < 5; i += 1) q.enqueue(meta, async () => ({ ok: true }));
    await tick(); await tick();
    expect(q.list().length).toBeLessThanOrEqual(3);
  });
});
