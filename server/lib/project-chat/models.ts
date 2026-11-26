import { createHash } from 'node:crypto';

import { parseRoutingTable } from '../llm-routing';
import { resolveKey, type LlmSettings } from '../../utils/llm-settings';

export function modelRevision(settings: LlmSettings, id: string) {
  const provider = settings.providers.find((item) => item.id === id);
  const route = parseRoutingTable(settings.routes).ask;
  return createHash('sha256').update(JSON.stringify([
    id, route?.providerId === id ? route.model : undefined,
    provider && [provider.type, provider.baseUrl, provider.model, resolveKey(provider), provider.enabled !== false]
  ])).digest('hex');
}

export function verifiedChatModels(settings: LlmSettings) {
  const entries = settings.chatVerified;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return [];
  return Object.entries(entries).filter(([id, revision]) => revision === modelRevision(settings, id)).map(([id]) => id);
}
