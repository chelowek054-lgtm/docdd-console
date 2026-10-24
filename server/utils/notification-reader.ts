import type { H3Event } from 'h3';

import { EVERYONE } from '../lib/notifications';
import { authEnabled, currentUser } from './auth';

/**
 * Кто читает колокольчик (R-0059): при включённом входе — вошедший (его логин),
 * без входа — консоль одного человека, ему видны все уведомления. Не вошёл при
 * включённом входе — `null`.
 */
export async function notificationReader(event: H3Event): Promise<string | null> {
  if (!authEnabled()) return EVERYONE;
  return (await currentUser(event))?.login ?? null;
}
