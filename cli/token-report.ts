// Расход токенов по задачам (R-0109). Модель не вызывается.
// Использование: tsx cli/token-report.ts [--task T-0183] [--project <id или корень>] [--baseline <файл>] [--compare <файл>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { argv, stdout } from 'node:process'

import { compareToBaseline, makeBaseline, renderTokenRows, tokenRows, type TokenBaseline } from '../server/lib/tokens'
import { readUsage } from '../server/utils/llm-usage-store'

const flag = (name: string) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined }
const task = flag('--task')
const project = flag('--project')
const rows = tokenRows(readUsage(), { ...(task ? { taskId: task } : {}), ...(project ? { projectIds: [project] } : {}) })

const baselineFile = flag('--baseline')
if (baselineFile) {
  mkdirSync(dirname(baselineFile), { recursive: true })
  writeFileSync(baselineFile, JSON.stringify(makeBaseline(rows, new Date().toISOString()), null, 2) + '\n', 'utf8')
}
stdout.write(renderTokenRows(rows) + '\n')

const compareFile = flag('--compare')
if (compareFile) {
  const baseline = JSON.parse(readFileSync(compareFile, 'utf8')) as TokenBaseline
  stdout.write('\nНа один заход, к базовой линии:\n')
  for (const row of compareToBaseline(baseline, rows)) {
    stdout.write(`${row.kind}: было ${row.before}, стало ${row.after}${row.changePercent === null ? '' : ` (${row.changePercent > 0 ? '+' : ''}${row.changePercent}%)`}\n`)
  }
}
