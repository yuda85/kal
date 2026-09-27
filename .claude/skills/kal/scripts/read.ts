import { run } from './lib/commands.ts';
import { loadConfig, requireFirestore } from './lib/config.ts';
import { createFirestoreReader } from './lib/firestore.ts';

try {
  const cfg = requireFirestore(loadConfig());
  const reader = createFirestoreReader({ ...cfg, emulatorHost: process.env.FIRESTORE_EMULATOR_HOST });
  const out = await run(process.argv.slice(2), { reader, now: new Date() });
  console.log(JSON.stringify(out, (_key, value) => (typeof value === 'number' ? Math.round(value * 10) / 10 : value), 2));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
