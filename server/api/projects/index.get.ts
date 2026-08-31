import { defineEventHandler } from 'h3';

import { listProjects } from '../../utils/projects';

export default defineEventHandler(async () => {
  const projects = await listProjects();
  return [...projects].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
});
