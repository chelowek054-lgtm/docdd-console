interface Verdict { allowed: boolean; reason?: string }
interface Me {
  required: boolean;
  user: { login: string; name: string; admin: boolean } | null;
  can: Record<string, Verdict> | null;
  /** Роли вошедшего в команде проекта: по ним выбирается роль шапки по умолчанию. */
  roles?: string[];
}

/**
 * Кто вошёл и что ему можно в проекте. Без включённого входа `required: false`
 * и всё разрешено — локальный режим не меняется (docs/adr/0020).
 */
export function useMe(projectId: MaybeRefOrGetter<string>) {
  const { data } = useFetch<Me>('/api/auth/me', {
    key: () => `me:${toValue(projectId)}`,
    query: computed(() => ({ project: toValue(projectId) })),
    default: () => ({ required: false, user: null, can: null })
  });
  /** Право на действие: вердикт сервера или «можно», если вход не требуется. */
  function allowed(action: string): Verdict {
    if (!data.value.required || !data.value.can) return { allowed: true };
    return data.value.can[action] ?? { allowed: true };
  }
  return { me: data, allowed };
}
