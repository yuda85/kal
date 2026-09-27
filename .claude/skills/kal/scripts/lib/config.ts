import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface KalConfig {
  baseUrl: string;
  projectId: string;
  uid: string;
}

export function loadConfig(): KalConfig {
  const path = process.env.KAL_CONFIG ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config.json');
  const cfg = JSON.parse(readFileSync(path, 'utf8')) as KalConfig;
  if (!cfg.baseUrl) throw new Error(`baseUrl missing in ${path}`);
  return cfg;
}

export function requireFirestore(cfg: KalConfig): { projectId: string; uid: string } {
  if (!cfg.projectId || !cfg.uid) {
    throw new Error('config.json needs projectId and uid — copy them from the app Settings screen into .claude/skills/kal/config.json');
  }
  return { projectId: cfg.projectId, uid: cfg.uid };
}
