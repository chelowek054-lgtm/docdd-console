/** Включён вход, а человек не вошёл — на экран входа (docs/adr/0020). */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return;
  const me = await $fetch<{ required: boolean; user: unknown }>('/api/auth/me', {
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
  }).catch(() => ({ required: false, user: null }));
  if (me.required && !me.user) return navigateTo('/login');
});
