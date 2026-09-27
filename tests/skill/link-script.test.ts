import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePayload, payloadParam } from '../../domain/index.ts';
import { FISH_BALLS } from '../../domain/testing.ts';

const script = join(process.cwd(), '.claude/skills/kal/scripts/link.ts');
const dir = mkdtempSync(join(tmpdir(), 'kal-'));
const config = join(dir, 'config.json');
writeFileSync(config, JSON.stringify({ baseUrl: 'https://example.test/kal/', projectId: '', uid: '' }));

function link(json: string) {
  return spawnSync(process.execPath, [script, json], { env: { ...process.env, KAL_CONFIG: config }, encoding: 'utf8' });
}

function payloadOf(stdout: string) {
  const url = stdout.trim();
  expect(url.startsWith('https://example.test/kal/#p=')).toBe(true);
  return decodePayload(payloadParam(new URL(url).hash)!);
}

describe('link.ts', () => {
  it('prints a confirm URL with defaults filled in', () => {
    const r = link(JSON.stringify({ ops: [{ op: 'add', name: 'שקשוקה', kcal: 420, protein: 22 }] }));
    expect(r.status).toBe(0);
    const p = payloadOf(r.stdout);
    expect(p.ops[0]).toMatchObject({ op: 'add', name: 'שקשוקה', kcal: 420, protein: 22 });
    expect(p.ops[0]).toHaveProperty('id');
    expect(p.ops[0]).toHaveProperty('date');
    expect(p.ops[0]).toHaveProperty('time');
  });

  it('computes an add from a recipe in the same link', () => {
    const recipe = { op: 'recipe', id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20 } };
    const r = link(JSON.stringify({ ops: [recipe, { op: 'add', name: '3 קציצות', recipeId: 'fish-balls', qty: 3 }] }));
    expect(r.status).toBe(0);
    expect(payloadOf(r.stdout).ops[1]).toMatchObject({ kcal: 188, protein: 18.1 });
  });

  it('fails clearly on invalid values', () => {
    const r = link(JSON.stringify({ ops: [{ op: 'add', name: 'x', kcal: 9000 }] }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('link error:');
    expect(r.stderr).toContain('kcal');
  });

  it('explains when a saved recipe is needed but config has no Firestore ids', () => {
    const r = link(JSON.stringify({ ops: [{ op: 'add', name: '2 קציצות', recipeId: 'fish-balls', qty: 2 }] }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('projectId and uid');
  });

  it('fails on non-JSON input', () => {
    const r = link('not json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('link error:');
  });
});
