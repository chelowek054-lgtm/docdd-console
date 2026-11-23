import { approvedMaps, foldMaps, parseMapRecord } from '../lib/maps';
import { looksLikeRecord, parseRecord } from '../lib/parse';
import { compareDesign } from '../lib/system-design';
import { readWorkspace } from '../lib/workspace';

export function compareProjectDesign(root: string) {
  const workspace = readWorkspace(root);
  const records = workspace.files.flatMap((file) => {
    if (!looksLikeRecord(file.text)) return [];
    const parsed = parseRecord(file.text, file.source);
    return parsed.ok ? [parsed.record] : [];
  });
  const map = foldMaps(approvedMaps(records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change })));
  return compareDesign(map.sysdesign, map.codemap, records);
}
