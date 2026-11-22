/**
 * Шаблоны карт на базовой карте (A-0010, R-0140). Шаблон — имя для людей, вид в файлах и набор
 * возможностей; файлы проекта знают только вид (`functional`, `codemap`…), поэтому старые записи
 * читаются без правки: шаблон лишь называет то, что уже лежит в записи.
 */

/** Возможности базовой карты, которые шаблон берёт: что он умеет сверх узлов и связей. */
export type MapCapability = 'nesting' | 'evidence' | 'health' | 'status' | 'reconcile' | 'standard';

export interface MapTemplate {
  /** Имя шаблона: так он назван в документах и стандарте обозначений. */
  id: string;
  /** Вид в файлах (блок `docdd-<kind>`); у System Design своего блока пока нет. */
  kind: string | null;
  /** Обязательная карта: её отсутствие — предупреждение `map_required_missing`. */
  required: boolean;
  /** Обязательна, только если у проекта есть код (`sources.code`). */
  needsCode?: boolean;
  /** Вопрос, на который карта отвечает. */
  question: string;
  capabilities: readonly MapCapability[];
}

export const MAP_TEMPLATES: readonly MapTemplate[] = [
  { id: 'strategic', kind: 'functional', required: true, question: 'куда движется проект', capabilities: ['nesting', 'health', 'status', 'standard'] },
  { id: 'domain', kind: 'domain', required: true, question: 'почему: предметная область и её законы', capabilities: ['nesting', 'standard'] },
  { id: 'sysdesign', kind: null, required: true, question: 'как будет реализовано', capabilities: ['nesting', 'standard'] },
  { id: 'codebase', kind: 'codemap', required: true, needsCode: true, question: 'что сделано сейчас', capabilities: ['nesting', 'evidence', 'reconcile', 'standard'] },
  { id: 'dataflow', kind: 'dataflow', required: false, question: 'откуда и куда идут данные', capabilities: ['evidence', 'reconcile'] },
  { id: 'userflow', kind: 'userflow', required: false, question: 'как человек идёт по экранам', capabilities: ['evidence', 'reconcile'] }
];

export const REQUIRED_TEMPLATES = MAP_TEMPLATES.filter((template) => template.required);

export function templateOfKind(kind: string): MapTemplate | undefined {
  return MAP_TEMPLATES.find((template) => template.kind === kind);
}

/**
 * Каких обязательных карт у проекта нет. `filled` — виды в файлах, у которых в сложенной
 * подтверждённой картине есть хоть один узел. Шаблон без своего блока (System Design до его
 * формата записи) не требуется: завести такую карту пока нечем, и предупреждение было бы
 * неисправимым.
 */
export function missingRequired(filled: ReadonlySet<string>, hasCode: boolean): MapTemplate[] {
  return REQUIRED_TEMPLATES.filter((template) =>
    template.kind !== null && !(template.needsCode && !hasCode) && !filled.has(template.kind));
}
