import { setResponseStatus, type H3Event } from 'h3';

/**
 * Единый вид ошибки из docs/03-server-api.md. Своё тело ответа, а не обёртка
 * Nitro: контракт написан до кода, и менять его ради удобства сервера нельзя.
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    detail?: string;
    blockers?: { code: string; message: string }[];
  };
}

/** Отказ с перечнем того, что мешает: 409 из docs/03-server-api.md. */
export function failWith(
  event: H3Event,
  status: number,
  code: string,
  message: string,
  blockers: { code: string; message: string }[]
): ApiError {
  setResponseStatus(event, status);
  return { error: { code, message, blockers } };
}

export function fail(
  event: H3Event,
  status: number,
  code: string,
  message: string,
  detail?: string
): ApiError {
  setResponseStatus(event, status);
  return { error: detail === undefined ? { code, message } : { code, message, detail } };
}
