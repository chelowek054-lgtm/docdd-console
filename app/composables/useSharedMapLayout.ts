import type { MapPositions } from '~/utils/map-layout-restore';

interface Presentation {
  revision: number;
  views: Record<string, MapPositions>;
  history: { at: string; accountId: string; kind: 'layout' | 'structure'; recordId?: string }[];
  canPublish?: boolean;
}

export function useSharedMapLayout(project: Ref<string>, map: Ref<string>) {
  const state = shallowRef<Presentation>();
  const pending = ref(false);
  const publishing = ref(false);
  const issue = ref<'load' | 'save' | 'conflict'>();
  const endpoint = computed(() => `/api/projects/${encodeURIComponent(project.value)}/map/presentation`);
  let generation = 0;

  async function load() {
    const version = generation;
    if (!project.value || !map.value) return;
    pending.value = true;
    try {
      const value = await $fetch<Presentation>(endpoint.value, { query: { map: map.value } });
      if (version === generation) {
        state.value = value;
        issue.value = undefined;
      }
    } catch {
      if (version === generation) issue.value = 'load';
    } finally {
      if (version === generation) pending.value = false;
    }
  }
  watch([project, map], () => {
    ++generation;
    state.value = undefined;
    issue.value = undefined;
    publishing.value = false;
    pending.value = false;
    void load();
  }, { immediate: true });

  async function publish(view: string, positions: MapPositions) {
    if (!state.value || publishing.value || pending.value) return false;
    const version = generation;
    publishing.value = true;
    issue.value = undefined;
    try {
      const value = await $fetch<Presentation>(endpoint.value, {
        method: 'PUT', body: { map: map.value, view, positions, revision: state.value.revision }
      });
      if (version !== generation) return false;
      state.value = value;
      return true;
    } catch (error) {
      if (version === generation) {
        const conflict = (error as { statusCode?: number }).statusCode === 409;
        if (conflict) await load();
        if (version === generation) {
          issue.value = conflict && issue.value !== 'load' ? 'conflict' : 'save';
        }
      }
      return false;
    } finally {
      if (version === generation) publishing.value = false;
    }
  }

  return { state, pending, publishing, issue, load, publish };
}
