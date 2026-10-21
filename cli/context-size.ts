// Замер размера запросов «до и после» пакета контекста (T-0031, ADR-0021, «Замер»).
// Модель не вызывается. Использование: tsx cli/context-size.ts [путь к проекту] [--task T-0031]
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { argv, stdout } from 'node:process'

import { fixPrompt, inboxPrompt, taskPrompt } from '../server/lib/prompt'
import { buildProjectMap } from '../server/utils/map-service'
import { packExtra } from '../server/utils/context-service'
import { referenceIndexText } from '../server/utils/reference-service'
import { inboxNotes } from '../server/utils/inbox-service'
import { loadIndex } from '../server/utils/index-service'
import { taskContext } from '../server/utils/work-service'

const args = argv.slice(2)
const taskFlag = args.indexOf('--task')
const taskId = taskFlag >= 0 ? args[taskFlag + 1] : undefined
const root = resolve(args.find((arg, at) => !arg.startsWith('--') && args[at - 1] !== '--task') ?? '.')
const template = (name: string) => readFileSync(join(root, 'docs', 'prompts', name), 'utf8')
const fallback = (name: string) => readFileSync(join(process.cwd(), 'docs', 'prompts', name), 'utf8')
const read = (name: string) => { try { return template(name) } catch { return fallback(name) } }

const index = loadIndex(root)
const rows: { kind: string, before: number, after: number, pack: number }[] = []

// fix: старый путь — без дополнения пакетом; новый — с ним.
const fixPack = packExtra(root, '', 'fix')
rows.push({ kind: 'fix', before: fixPrompt(read('fix-plan.md'), index.issues).length, after: fixPrompt(read('fix-plan.md'), index.issues, fixPack).length, pack: fixPack.length })

// task: старый путь — карта кода целиком в самом запросе; новый — куском пакета.
const tasks = index.records.filter((item) => item.type === 'task')
const picked = tasks.find((item) => item.id === taskId) ?? tasks.find((item) => item.status === 'ready') ?? tasks[0]
if (picked) {
  const context = taskContext(root, index, picked, '', '', 1)
  const modules = buildProjectMap(root).codemap.modules
  const before = taskPrompt(read('task.md'), { ...context, pack: '', modules }).length
  rows.push({ kind: `task ${picked.id}`, before, after: taskPrompt(read('task.md'), context).length, pack: context.pack?.length ?? 0 })
}

// inbox: те же заметки и справочник; разница — только дополнение пакетом.
const notes = inboxNotes(root)
const known = index.records.map((record) => ({ id: record.id, type: record.type, title: record.title }))
const capabilities = buildProjectMap(root).functional.capabilities
const reference = referenceIndexText(root)
const inboxPack = packExtra(root, '', 'inbox', notes.map((note) => note.text).join('\n'))
rows.push({
  kind: 'inbox',
  before: inboxPrompt(read('inbox-plan.md'), notes, known, capabilities, reference).length,
  after: inboxPrompt(read('inbox-plan.md'), notes, known, capabilities, reference, inboxPack).length,
  pack: inboxPack.length
})

stdout.write(`Размер запросов в знаках, проект ${root}\n`)
for (const row of rows) stdout.write(`${row.kind}: до ${row.before}, после ${row.after} (пакет ${row.pack}), ${row.after - row.before >= 0 ? '+' : ''}${row.after - row.before}\n`)
