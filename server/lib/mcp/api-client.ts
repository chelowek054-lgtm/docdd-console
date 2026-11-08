import type { ApiAnswer, ApiClient } from './types';

export interface ApiClientOptions {
  baseUrl: string;
  token?: string | undefined;
  fetcher?: typeof fetch;
}

/** Единственный путь MCP к данным проекта: правила и права проверяет API консоли (A-0002). */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetcher = options.fetcher ?? fetch;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token) headers['authorization'] = `Bearer ${options.token}`;

  const send = async (method: string, path: string, body?: unknown): Promise<ApiAnswer> => {
    let response: Response;
    try {
      response = await fetcher(`${options.baseUrl}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch {
      throw new Error(`Консоль не отвечает на ${options.baseUrl}. Запустите её (npm run start:built) или задайте адрес в DOCDD_URL.`);
    }
    const data: unknown = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  };

  return { get: (path) => send('GET', path), post: (path, body) => send('POST', path, body) };
}

interface ErrorBody { error?: { code?: string; message?: string; details?: { message?: string }[] } }

/** Отказ API называет причину: модель видит её и не повторяет запрос вслепую. */
export function requireOk(answer: ApiAnswer): unknown {
  if (answer.ok) return answer.data;
  const error = (answer.data as ErrorBody | null)?.error;
  const details = (error?.details ?? []).map((item) => item.message).filter(Boolean).join('; ');
  throw new Error(`Отказ консоли (${answer.status}${error?.code ? `, ${error.code}` : ''}): ${error?.message ?? 'без объяснения'}${details ? `: ${details}` : ''}`);
}

export const projectPath = (projectId: string, rest: string): string => `/api/projects/${encodeURIComponent(projectId)}${rest}`;
