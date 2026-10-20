import { defineEventHandler } from 'h3';

import { loadUsers } from '../../utils/auth';

/** Список людей для экрана «Люди»; хеши не отдаём. Доступ — только администратору (server/middleware/auth.ts). */
export default defineEventHandler(async () =>
  (await loadUsers()).map(({ login, name, admin }) => ({ login, name, admin })));
