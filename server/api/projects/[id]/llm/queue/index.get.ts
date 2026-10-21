import { defineEventHandler, getRouterParam } from 'h3';

import { llmQueue } from '../../../../../utils/llm-gateway';

/** Очередь запросов к модели по проекту: видна всей команде, живёт в памяти сервера. */
export default defineEventHandler((event) => ({ jobs: llmQueue.list(getRouterParam(event, 'id') ?? '') }));
