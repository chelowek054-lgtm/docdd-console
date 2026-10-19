// Иерархия карт (ADR-0027). Чистые функции над массивами: ни Nuxt, ни файловой
// системы, чтобы одну и ту же свёртку использовали три карты и её можно было
// проверять без сервера.

export interface TreeNode {
  id: string
  parent?: string | undefined
}

export interface Edge {
  from: string
  to: string
  kind?: string
  verdict?: string
}

export interface FoldedEdge {
  from: string
  to: string
  count: number
  kinds: string[]
  worst: string | undefined
  /** Исходные связи: стрелку всегда можно развернуть до опоры внизу. */
  members: Edge[]
}

export interface FoldResult {
  edges: FoldedEdge[]
  /** Связи, оба конца которых свернулись в один видимый узел. */
  internal: number
}

function parentIndex(nodes: readonly TreeNode[]): Map<string, string | undefined> {
  const m = new Map<string, string | undefined>()
  for (const n of nodes) m.set(n.id, n.parent)
  return m
}

/**
 * Предки от родителя к корню. Данные пишут люди, поэтому цикл `parent` и
 * родитель-призрак не должны ронять расчёт: цикл обрывается на повторе,
 * несуществующий родитель делает узел корнем.
 */
export function ancestors(id: string, nodes: readonly TreeNode[]): string[] {
  const parents = parentIndex(nodes)
  const seen = new Set<string>([id])
  const chain: string[] = []
  let cur = parents.get(id)
  while (cur !== undefined && parents.has(cur) && !seen.has(cur)) {
    chain.push(cur)
    seen.add(cur)
    cur = parents.get(cur)
  }
  return chain
}

/** Путь от корня к узлу включительно; индекс в нём равен глубине. */
function pathFromRoot(id: string, nodes: readonly TreeNode[]): string[] {
  return [...ancestors(id, nodes).reverse(), id]
}

export function depthOf(id: string, nodes: readonly TreeNode[]): number {
  return ancestors(id, nodes).length
}

export function maxDepth(nodes: readonly TreeNode[]): number {
  let max = 0
  for (const n of nodes) max = Math.max(max, depthOf(n.id, nodes))
  return max
}

/** Ближайший предок (или сам узел) не глубже `level`; 0 — корень. */
export function visibleAncestor(id: string, nodes: readonly TreeNode[], level: number): string {
  const path = pathFromRoot(id, nodes)
  return path[Math.min(Math.max(level, 0), path.length - 1)] ?? id
}

/**
 * Видимый узел при раскрытой на месте группе `openId`. Внутри неё показываем
 * уровень `level` ниже группы; снаружи всё свёрнуто до уровня самой группы,
 * чтобы соседи остались рядом с ней, а не уехали на другой масштаб.
 */
export function visibleAt(
  id: string,
  nodes: readonly TreeNode[],
  openId: string | null,
  level: number,
): string {
  if (openId === null) return visibleAncestor(id, nodes, level)
  const openDepth = depthOf(openId, nodes)
  const path = pathFromRoot(id, nodes)
  if (path[openDepth] === openId) {
    return path[Math.min(openDepth + Math.max(level, 0), path.length - 1)] ?? id
  }
  return visibleAncestor(id, nodes, openDepth)
}

/**
 * Свёртка связей до видимых узлов. Внутренние связи (оба конца под одним
 * видимым узлом) не рисуются стрелкой, но считаются: по ним видно связность.
 */
export function foldEdges(
  edges: readonly Edge[],
  visible: (id: string) => string,
  worstOf: (verdicts: string[]) => string = (v) => v[0] ?? '',
): FoldResult {
  const groups = new Map<string, FoldedEdge>()
  let internal = 0
  for (const e of edges) {
    const from = visible(e.from)
    const to = visible(e.to)
    if (from === to) {
      internal++
      continue
    }
    const key = `${from}\u0000${to}`
    let f = groups.get(key)
    if (!f) {
      f = { from, to, count: 0, kinds: [], worst: undefined, members: [] }
      groups.set(key, f)
    }
    f.count++
    f.members.push(e)
    if (e.kind !== undefined && !f.kinds.includes(e.kind)) f.kinds.push(e.kind)
  }
  for (const f of groups.values()) {
    const verdicts = f.members.flatMap((m) => (m.verdict === undefined ? [] : [m.verdict]))
    f.worst = verdicts.length > 0 ? worstOf(verdicts) : undefined
  }
  return { edges: [...groups.values()], internal }
}

/** Узлы поддерева группы, сама группа включена. */
function subtree(groupId: string, nodes: readonly TreeNode[]): Set<string> {
  const set = new Set<string>([groupId])
  for (const n of nodes) {
    if (ancestors(n.id, nodes).includes(groupId)) set.add(n.id)
  }
  return set
}

/** Связи внутри поддерева группы и связи, выходящие наружу (в любую сторону). */
export function groupCohesion(
  groupId: string,
  nodes: readonly TreeNode[],
  edges: readonly Edge[],
): { inside: number; outside: number } {
  const set = subtree(groupId, nodes)
  let inside = 0
  let outside = 0
  for (const e of edges) {
    const a = set.has(e.from)
    const b = set.has(e.to)
    if (a && b) inside++
    else if (a || b) outside++
  }
  return { inside, outside }
}

/**
 * Циклы между видимыми узлами: компоненты сильной связности (Тарьян) размером
 * больше одного. Петли не считаем — их свёртка уже отправила во внутренние.
 */
export function cyclesAt(edges: readonly { from: string; to: string }[]): string[][] {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)?.push(e.to)
    if (!adj.has(e.to)) adj.set(e.to, [])
  }
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const result: string[][] = []
  let counter = 0

  const visit = (v: string): void => {
    index.set(v, counter)
    low.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w)
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0))
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = []
      let w: string | undefined
      do {
        w = stack.pop()
        if (w === undefined) break
        onStack.delete(w)
        comp.push(w)
      } while (w !== v)
      if (comp.length > 1) result.push(comp)
    }
  }
  for (const v of adj.keys()) if (!index.has(v)) visit(v)
  return result
}

/** Подсказки дробления: только для экрана, правилами они не являются. */
export function splitHints(
  groupId: string,
  nodes: readonly TreeNode[],
  edges: readonly Edge[],
): string[] {
  const hints: string[] = []
  const children = nodes.filter((n) => n.parent === groupId).length
  if (children > 9) hints.push('too_many_children')
  if (children === 1) hints.push('single_child')
  const { inside, outside } = groupCohesion(groupId, nodes, edges)
  if (outside > inside) hints.push('more_outside_than_inside')
  return hints
}

/** Контекст для текстов подсказок: что подставить в сообщение. */
export interface HintContext {
  title?: string
  children?: number
  inside?: number
  outside?: number
  /** Соседи по циклу (названия или id). */
  cycle?: readonly string[]
}

/**
 * Русские тексты подсказок по кодам из `splitHints` и `cyclesAt`.
 * Неизвестный код пропускается: подсказки только для экрана, ломаться из-за них нечему.
 */
export function splitHintTexts(codes: string[], ctx: HintContext = {}): string[] {
  const who = ctx.title ? `«${ctx.title}»` : 'Группа'
  const texts: string[] = []
  for (const code of codes) {
    if (code === 'too_many_children') {
      const n = ctx.children === undefined ? 'больше 9' : String(ctx.children)
      texts.push(`${who}: детей ${n}, это больше девяти — пора дробить на подгруппы.`)
    } else if (code === 'single_child') {
      texts.push(`${who}: один ребёнок — лишний уровень, группу можно убрать или добавить ей соседей.`)
    } else if (code === 'more_outside_than_inside') {
      const nums =
        ctx.inside !== undefined && ctx.outside !== undefined
          ? ` (внутри ${ctx.inside}, наружу ${ctx.outside})`
          : ''
      texts.push(`${who}: связей наружу больше, чем внутри${nums} — граница проведена не там.`)
    } else if (code === 'cycle') {
      const ring = ctx.cycle?.length ? `: ${ctx.cycle.join(' → ')}` : ''
      texts.push(`Цикл между соседями${ring} — они зависят друг от друга, разорвите связь или объедините их.`)
    }
  }
  return texts
}
