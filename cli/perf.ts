// Бюджет скорости страниц (R-0051): обходит страницы запущенной консоли,
// сравнивает с perf-budget.json и пишет отчёт проверок-метрик.
// Использование: tsx cli/perf.ts [--out <папка>] [--project <id>] [--base <url>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface PageBudget {
  path: string
  verification: string
  maxTtfbMs?: number
  maxHtmlKb?: number
  maxPayloadKb?: number
}
interface Budget { base: string, project: string, pages: PageBudget[] }
interface Measure { ttfbMs: number, htmlKb: number, payloadKb: number }

// Размер блока __NUXT_DATA__: именно он раздувается, когда в страницу встроен индекс.
export function payloadBytes(html: string): number {
  const m = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  return m ? Buffer.byteLength(m[1]!) : 0
}

export function overBudget(m: Measure, b: PageBudget): string[] {
  const out: string[] = []
  if (b.maxTtfbMs !== undefined && m.ttfbMs > b.maxTtfbMs) out.push(`первый байт ${Math.round(m.ttfbMs)} мс > ${b.maxTtfbMs}`)
  if (b.maxHtmlKb !== undefined && m.htmlKb > b.maxHtmlKb) out.push(`HTML ${m.htmlKb.toFixed(1)} КБ > ${b.maxHtmlKb}`)
  if (b.maxPayloadKb !== undefined && m.payloadKb > b.maxPayloadKb) out.push(`payload ${m.payloadKb.toFixed(1)} КБ > ${b.maxPayloadKb}`)
  return out
}

async function measure(url: string): Promise<Measure> {
  const t0 = performance.now()
  const res = await fetch(url)
  const ttfbMs = performance.now() - t0
  const html = await res.text()
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return { ttfbMs, htmlKb: Buffer.byteLength(html) / 1024, payloadKb: payloadBytes(html) / 1024 }
}

async function main() {
  const args = process.argv.slice(2)
  const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
  const budget = JSON.parse(readFileSync(resolve(process.cwd(), 'perf-budget.json'), 'utf8')) as Budget
  const base = arg('--base') ?? budget.base
  const project = arg('--project') ?? budget.project
  const outDir = arg('--out') ?? join('docs', 'development', 'tests', 'reports')
  const startedAt = new Date()
  const verifications: Record<string, 'passed' | 'failed'> = {}

  for (const page of budget.pages) {
    const url = base + page.path.replace('{id}', project)
    let problems: string[]
    try {
      await measure(url) // прогрев: первый запрос после правки компилирует страницу
      const m = await measure(url)
      problems = overBudget(m, page)
      console.log(`${problems.length ? 'FAIL' : 'ok  '} ${page.verification} ${url} ttfb=${Math.round(m.ttfbMs)}мс html=${m.htmlKb.toFixed(1)}КБ payload=${m.payloadKb.toFixed(1)}КБ`)
    } catch (e) {
      problems = [(e as Error).message]
      console.log(`FAIL ${page.verification} ${url}: ${problems[0]}`)
    }
    for (const p of problems) console.log(`     ${p}`)
    // Проверка падает, если упала любая из её страниц.
    if (problems.length || verifications[page.verification] === undefined) {
      verifications[page.verification] = problems.length ? 'failed' : (verifications[page.verification] ?? 'passed')
    }
  }

  const values = Object.values(verifications)
  const report = {
    contract: 'docdd.workspace/1',
    runner: 'perf',
    started_at: startedAt.toISOString(),
    total: values.length,
    failed: values.filter(v => v === 'failed').length,
    verifications
  }
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, `${startedAt.toISOString().slice(0, 10)}-perf.json`)
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n')
  console.log(`Отчёт: ${file}`)
  process.exitCode = report.failed ? 1 : 0
}

if (process.argv[1]?.split(String.fromCharCode(92)).join('/').endsWith('cli/perf.ts')) void main()
