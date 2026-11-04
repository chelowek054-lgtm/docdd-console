/**
 * Сторож запросов (docs/adr/0039-hardening-local-and-login.md): без входа консоль доверяет
 * каждому запросу, поэтому чужая страница в браузере человека не должна до неё дотянуться —
 * ни подменой имени сервера (DNS rebinding), ни пишущим запросом с другого сайта.
 */

export interface GuardRequest {
  method: string;
  path: string;
  host: string | undefined;
  forwardedHost: string | undefined;
  origin: string | undefined;
  fetchSite: string | undefined;
}

export interface GuardOptions {
  /**
   * Чисто локальный режим: входа нет (`DOCDD_AUTH`) и это не общий сервер (`DOCDD_MODE=shared`).
   * Только тогда Host сужается до localhost: на сервере имя публичное, его знает nginx.
   */
  local: boolean;
  /** `DOCDD_ALLOWED_HOSTS` — имена через запятую, без порта. */
  allowedHosts: readonly string[];
}

export type GuardVerdict = { allowed: true } | { allowed: false; code: 'host_forbidden' | 'cross_origin_forbidden'; message: string };

const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]', '::1'];
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Имя без порта и в нижнем регистре: `[::1]:3000` → `[::1]`, `Localhost:3000` → `localhost`. */
export function hostName(value: string): string {
  const host = value.trim().toLowerCase();
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0] ?? '';
}

export function parseAllowedHosts(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => hostName(item)).filter(Boolean);
}

export function guardRequest(request: GuardRequest, options: GuardOptions): GuardVerdict {
  const host = request.host ? hostName(request.host) : '';
  const allowed = options.local ? [...LOCAL_HOSTS, ...options.allowedHosts] : options.allowedHosts;
  if (allowed.length > 0 && !allowed.includes(host)) {
    return { allowed: false, code: 'host_forbidden', message: `Имя сервера «${host || 'пусто'}» не разрешено. Добавьте его в DOCDD_ALLOWED_HOSTS.` };
  }

  if (!UNSAFE.has(request.method.toUpperCase()) || !request.path.startsWith('/api/')) return { allowed: true };
  if (request.fetchSite?.toLowerCase() === 'cross-site') {
    return { allowed: false, code: 'cross_origin_forbidden', message: 'Запрос пришёл с чужой страницы' };
  }
  if (request.origin && request.origin !== 'null') {
    let originHost = '';
    try {
      originHost = hostName(new URL(request.origin).host);
    } catch {
      return { allowed: false, code: 'cross_origin_forbidden', message: 'Непонятный заголовок Origin' };
    }
    // Сравниваем имена без порта: nginx передаёт Host без него, а Origin несёт порт.
    const own = hostName((request.forwardedHost ?? request.host ?? '').split(',')[0] ?? '');
    if (originHost !== own) return { allowed: false, code: 'cross_origin_forbidden', message: 'Запрос пришёл с чужой страницы' };
  } else if (request.origin === 'null') {
    // Изолированный iframe (макеты) и file:// шлют Origin: null — писать им незачем.
    return { allowed: false, code: 'cross_origin_forbidden', message: 'Запрос пришёл из изолированной страницы' };
  }
  return { allowed: true };
}
