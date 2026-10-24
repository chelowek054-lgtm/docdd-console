import yaml from 'js-yaml';

/**
 * Агенты ролей (R-0091, docs/adr/0033-role-agents.md): определение агента — файл
 * проекта `docs/agents/<id>.md`, ограничения аккаунта агента — здесь, в коде
 * консоли. Чистые функции: разбор, запись, набор по умолчанию и вердикт прав.
 */

export const AGENTS_DIR = 'docs/agents';

/** Что агенту доступно: читать, предлагать (входящее, обсуждения), двигать статусы задач и проверок, работать с кодом в ветке задачи. */
export const AGENT_ACCESS = ['read', 'propose', 'statuses', 'code'] as const;
export type AgentAccess = (typeof AGENT_ACCESS)[number];

export interface AgentDef {
  id: string;
  type: string;
  title: string;
  /** Модель из настроенных провайдеров; пусто — по маршруту вида запроса. */
  model?: string;
  access: AgentAccess;
  /** Системный промпт — тело файла. */
  prompt: string;
}

export interface AgentType { type: string; title: string; access: AgentAccess; role: string; prompt: string }

const RULES = 'Ты работаешь в проекте по правилу «документ ведёт код». Записи процесса и текст документов не правь: предлагай правку заметкой во входящее. Документы не подтверждай — это делает человек. Свою работу не принимай.';

/** Восемь типов по умолчанию (R-0091). Роль — какой роли проекта агент обычно закрывает место. */
export const AGENT_TYPES: readonly AgentType[] = [
  { type: 'architect', title: 'Архитектор', access: 'propose', role: 'architect', prompt: `${RULES}\n\nТы архитектор. Сверяешь задачи и код с решениями (ADR), картами и модулями с публичным входом; находишь, где устройство расходится с документами, и предлагаешь правку документа или задачу.` },
  { type: 'analyst', title: 'Аналитик', access: 'propose', role: 'analyst', prompt: `${RULES}\n\nТы аналитик. Ищешь неоднозначности, противоречия между требованиями и требования без критерия готовности; к каждому пробелу — уточняющий вопрос автору.` },
  { type: 'developer', title: 'Разработчик', access: 'code', role: 'developer', prompt: `${RULES}\n\nТы разработчик. Реализуешь задачу ровно по требованию и карте в ветке задачи: сначала справочник (что уже есть), потом код и тест, затем дифф на проверку человеку.` },
  { type: 'qa', title: 'Тестировщик', access: 'statuses', role: 'qa', prompt: `${RULES}\n\nТы тестировщик. Прогоняешь проверки по шагам и ожидаемому результату, записываешь прогон с итогом каждой проверки; провал — с шагами воспроизведения и вложениями, блокировка — с причиной.` },
  { type: 'devops', title: 'DevOps', access: 'statuses', role: 'devops', prompt: `${RULES}\n\nТы DevOps. Следишь за сборкой, окружениями и релизами: что готово к выпуску, что выложено куда, что сломалось после выкладки.` },
  { type: 'designer', title: 'Дизайнер', access: 'propose', role: 'designer', prompt: `${RULES}\n\nТы дизайнер. Сверяешь экраны с дизайн-системой и путями пользователя: адаптивность, состояния, доступность; расхождения — заметкой с указанием экрана.` },
  { type: 'marketer', title: 'Маркетолог', access: 'propose', role: 'analyst', prompt: `${RULES}\n\nТы маркетолог. Смотришь на продукт глазами пользователя и рынка: понятность ценности, тексты, путь до первой пользы; предложения — заметкой во входящее.` },
  { type: 'critic', title: 'Критик', access: 'read', role: 'viewer', prompt: `${RULES}\n\nТы критик. Ищешь слабые места: риски, недоказанные допущения, дыры в проверках и безопасности. Сначала критика, потом что с этим сделать.` }
];

export function agentType(type: string): AgentType | null {
  return AGENT_TYPES.find((item) => item.type === type) ?? null;
}

const ID = /^[a-z][a-z0-9-]{1,39}$/;

/** Разбор файла агента; не годится — причина словами, а не исключение. */
export function parseAgent(text: string): { ok: true; agent: AgentDef } | { ok: false; problem: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { ok: false, problem: 'Нет front matter между строками ---' };
  let data: Record<string, unknown>;
  try {
    data = (yaml.load(match[1] ?? '') ?? {}) as Record<string, unknown>;
  } catch (error) {
    return { ok: false, problem: `Front matter не читается: ${String(error)}` };
  }
  const id = typeof data['id'] === 'string' ? data['id'] : '';
  const type = typeof data['type'] === 'string' ? data['type'] : '';
  const access = data['access'];
  if (!ID.test(id)) return { ok: false, problem: 'id — латиница, цифры и дефис, с буквы, 2–40 знаков' };
  if (!type) return { ok: false, problem: 'Не указан type' };
  if (typeof access !== 'string' || !(AGENT_ACCESS as readonly string[]).includes(access)) return { ok: false, problem: `access — одно из: ${AGENT_ACCESS.join(', ')}` };
  return {
    ok: true,
    agent: {
      id, type, access: access as AgentAccess,
      title: typeof data['title'] === 'string' && data['title'].trim() ? data['title'].trim() : id,
      ...(typeof data['model'] === 'string' && data['model'].trim() ? { model: data['model'].trim() } : {}),
      prompt: (match[2] ?? '').trim()
    }
  };
}

/** Текст файла агента: front matter и промпт. */
export function agentText(agent: AgentDef): string {
  const front = yaml.dump({ id: agent.id, type: agent.type, title: agent.title, ...(agent.model ? { model: agent.model } : {}), access: agent.access }, { lineWidth: 200 }).trimEnd();
  return `---\n${front}\n---\n\n${agent.prompt.trim()}\n`;
}

/** Агент из типа по умолчанию: id — тип, если не задан другой. */
export function agentFromType(type: AgentType, id = type.type): AgentDef {
  return { id, type: type.type, title: type.title, access: type.access, prompt: type.prompt };
}

// --- ограничения аккаунта агента (ADR-0033, п. 3) ---

/** Действия, которых у агента нет при любой роли: сливает и управляет командой человек. */
export const AGENT_FORBIDDEN_ACTIONS: ReadonlySet<string> = new Set(['merge', 'team', 'admin']);

export interface AgentRecord { id: string; type: string; status: string; links: Readonly<Partial<Record<string, readonly string[]>>>; extra?: Readonly<Record<string, unknown>> | undefined }

export interface AgentVerdict { allowed: boolean; code?: 'agent_text_edit' | 'agent_document_approve' | 'agent_own_acceptance'; reason?: string }

const assigneeOf = (record: AgentRecord | undefined) => (typeof record?.extra?.['assignee'] === 'string' ? record.extra['assignee'] : '');

/** Задачи, которые проверяет проверка: прямо (`verified_by`) или через требование, которое реализуют. */
function tasksOfCheck(checkId: string, records: readonly AgentRecord[]): AgentRecord[] {
  const check = records.find((record) => record.id === checkId);
  const requirements = new Set(check?.links['verifies'] ?? []);
  for (const record of records) if (record.type === 'requirement' && (record.links['verified_by'] ?? []).includes(checkId)) requirements.add(record.id);
  return records.filter((record) => record.type === 'task' && ((record.links['verified_by'] ?? []).includes(checkId) || (record.links['implements'] ?? []).some((id) => requirements.has(id))));
}

/**
 * Можно ли агенту `login` этот запрос — поверх прав его роли. Документы агент
 * не подтверждает никогда, текст не правит, свою работу не принимает.
 */
export function agentVerdict(login: string, method: string, path: string, body: Record<string, unknown> | null, records: readonly AgentRecord[]): AgentVerdict {
  if (method.toUpperCase() === 'GET') return { allowed: true };
  const byId = new Map(records.map((record) => [record.id, record]));

  if (/\/records\/[^/]+\/body\/?$/.test(path)) {
    return { allowed: false, code: 'agent_text_edit', reason: 'Агент не правит текст документов: предложите правку заметкой во входящее' };
  }

  const status = typeof body?.['status'] === 'string' ? body['status'] : '';
  const single = /\/records\/([^/]+)\/status\/?$/.exec(path)?.[1];
  if (single) {
    const record = byId.get(decodeURIComponent(single));
    if (status === 'approved' && record && record.type !== 'task') {
      return { allowed: false, code: 'agent_document_approve', reason: 'Документы подтверждает только человек' };
    }
    if (status === 'done' && record?.type === 'task' && assigneeOf(record) === login) {
      return { allowed: false, code: 'agent_own_acceptance', reason: 'Свою работу агент не принимает: закрывает задачу ревьюер' };
    }
  }

  if (/\/records\/bulk\/status\/?$/.test(path)) {
    const ids = Array.isArray(body?.['ids']) ? (body['ids'] as unknown[]).filter((id): id is string => typeof id === 'string') : [];
    // Массовый переход «вперёд» может подтвердить документ: агенту — только задачи.
    if (ids.some((id) => byId.get(id)?.type !== 'task')) {
      return { allowed: false, code: 'agent_document_approve', reason: 'Массовая смена статуса с документами — только человеку: документы подтверждает человек' };
    }
  }

  const checked = /\/records\/([^/]+)\/verified\/?$/.exec(path)?.[1];
  if (checked && tasksOfCheck(decodeURIComponent(checked), records).some((task) => assigneeOf(task) === login)) {
    return { allowed: false, code: 'agent_own_acceptance', reason: 'Свою работу агент не принимает: «Проверено» по своей задаче ставит другой' };
  }

  return { allowed: true };
}

/** Подпись в журнале: `QA-агент (qa) · агент` — видно, что действие сделал агент. */
export const agentSignature = (signed: string): string => `${signed} · агент`;
