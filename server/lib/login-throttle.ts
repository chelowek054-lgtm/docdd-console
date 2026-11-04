/**
 * Ограничение попыток входа (docs/adr/0039-hardening-local-and-login.md): 5 неудач с одного
 * адреса на один логин за 15 минут — дальше отказ до конца окна. Память процесса: перезапуск
 * сбрасывает счёт, и это осознанно — окно короткое, второе хранилище ради него не нужно.
 */

export const LOGIN_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface Attempts {
  failures: number;
  since: number;
}

export class LoginThrottle {
  private readonly attempts = new Map<string, Attempts>();

  constructor(private readonly limit = LOGIN_ATTEMPTS, private readonly windowMs = LOGIN_WINDOW_MS) {}

  private key(address: string, login: string): string {
    return `${address}\u0000${login.toLowerCase()}`;
  }

  /** Сколько миллисекунд ещё ждать; 0 — пробовать можно. */
  retryAfter(address: string, login: string, now: number): number {
    const entry = this.attempts.get(this.key(address, login));
    if (!entry) return 0;
    if (now - entry.since >= this.windowMs) {
      this.attempts.delete(this.key(address, login));
      return 0;
    }
    return entry.failures >= this.limit ? entry.since + this.windowMs - now : 0;
  }

  fail(address: string, login: string, now: number): void {
    const key = this.key(address, login);
    const entry = this.attempts.get(key);
    if (!entry || now - entry.since >= this.windowMs) this.attempts.set(key, { failures: 1, since: now });
    else entry.failures += 1;
    // Старые окна не копятся: при каждой неудаче вычищаем истёкшие.
    if (this.attempts.size > 10_000) {
      for (const [other, value] of this.attempts) if (now - value.since >= this.windowMs) this.attempts.delete(other);
    }
  }

  succeed(address: string, login: string): void {
    this.attempts.delete(this.key(address, login));
  }
}
