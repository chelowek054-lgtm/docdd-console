/**
 * Роли вошедшего в проекте из контекста запроса (их кладёт server/middleware/auth.ts).
 * `null` — вход выключен: личный режим, ограничений по ролям нет.
 */
export function rolesOf(context: Record<string, unknown>): string[] | null {
  const user = context['user'] as { roles?: unknown } | undefined;
  if (!user) return null;
  return Array.isArray(user.roles) ? user.roles.filter((role): role is string => typeof role === 'string') : [];
}
