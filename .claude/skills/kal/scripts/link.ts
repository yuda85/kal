import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  buildUrl,
  fillDefaults,
  newLinkId,
  pendingRecipeIds,
  recipesInPayload,
  resolveRecipePortions,
  validatePayload,
} from '../../../../domain/index.ts';
import { loadConfig, requireFirestore } from './lib/config.ts';
import { createFirestoreReader } from './lib/firestore.ts';
import { loadRecipes } from './lib/load.ts';

const args = process.argv.slice(2);
const open = args.includes('--open');
const json = args.find((a) => a !== '--open');

try {
  const cfg = loadConfig();
  const draft = JSON.parse(json ?? readFileSync(0, 'utf8'));
  const filled = fillDefaults(draft, new Date(), newLinkId);

  const local = recipesInPayload(filled);
  const missing = pendingRecipeIds(filled).filter((id) => !local.some((r) => r.id === id));
  const saved = missing.length > 0
    ? await loadRecipes(createFirestoreReader({ ...requireFirestore(cfg), emulatorHost: process.env.FIRESTORE_EMULATOR_HOST }))
    : [];

  const payload = validatePayload(resolveRecipePortions(filled, [...local, ...saved]));
  const url = buildUrl(cfg.baseUrl, payload);
  console.log(url);

  if (open) {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
  }
} catch (e) {
  console.error(`link error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
