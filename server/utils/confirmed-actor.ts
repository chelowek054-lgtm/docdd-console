import { confirmationActor, parseConfirmation } from '../lib/confirmation';
import { readManifest } from '../lib/workspace';

/**
 * Подпись журнала с подтверждением человека (A-0008, R-0133): «<кто> через <агент>, вопрос: …, ответ: …».
 * Права на решение архитектора — по ролям ответившего, если он участник команды: решает он, а не агент.
 * Роли из подтверждения — только у агента: человек со входом подписывается сам и чужими ролями не пользуется.
 */
export type ConfirmedActor =
  | { ok: true; actor: string; roles: readonly string[] | null }
  | { ok: false; message: string };

export function confirmedActor(root: string, body: { confirmation?: unknown } | null | undefined, actor: string, context: Record<string, unknown>): ConfirmedActor {
  const parsed = parseConfirmation(body?.confirmation);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (!parsed.confirmation) return { ok: true, actor, roles: null };
  const user = context['user'] as { agent?: unknown } | undefined;
  if (user && !user.agent) return { ok: true, actor: confirmationActor(actor, parsed.confirmation), roles: null };
  let roles: readonly string[] | null = null;
  try {
    roles = readManifest(root).team?.find((member) => member.login === parsed.confirmation?.by)?.roles ?? null;
  } catch {
    roles = null;
  }
  return { ok: true, actor: confirmationActor(actor, parsed.confirmation), roles };
}
