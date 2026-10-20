import { watchEffect } from 'vue';

interface Verdict { allowed: boolean; reason?: string }
interface Me { required: boolean; can: Record<string, Verdict> | null }

/**
 * `v-can="'work'"` — общая причина неактивной кнопки (T-0017, docs/04-ui.md):
 * без права кнопка не прячется, а блокируется и называет причину в подсказке.
 * Один запрос `/api/auth/me` на проект на все кнопки экрана; без входа ничего не меняется.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const state = useState<Record<string, Me>>('can-me', () => ({}));
  const pending = new Set<string>();
  const router = useRouter();

  function ensure(projectId: string) {
    if (!projectId || state.value[projectId] || pending.has(projectId)) return;
    pending.add(projectId);
    $fetch<Me>('/api/auth/me', { query: { project: projectId } })
      .then((me) => { state.value = { ...state.value, [projectId]: me }; })
      .catch(() => { state.value = { ...state.value, [projectId]: { required: false, can: null } }; })
      .finally(() => pending.delete(projectId));
  }

  nuxtApp.vueApp.directive('can', {
    mounted(el: HTMLElement & { __canStop?: () => void }, binding) {
      const apply = () => {
        const projectId = String(router.currentRoute.value.params['id'] ?? '');
        ensure(projectId);
        const me = state.value[projectId];
        const verdict = me?.required && me.can ? me.can[String(binding.value)] : undefined;
        if (verdict && !verdict.allowed) {
          el.setAttribute('disabled', 'true');
          el.setAttribute('aria-disabled', 'true');
          el.title = verdict.reason ?? 'Нет права на это действие';
        }
      };
      el.__canStop = watchEffect(apply);
    },
    unmounted(el: HTMLElement & { __canStop?: () => void }) {
      el.__canStop?.();
    }
  });
});
