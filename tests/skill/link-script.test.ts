import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  const url = stdout.trim().split('\n')[0];
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

  it('prints a summary of the resolved items on the second line', () => {
    const recipe = { op: 'recipe', id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20 } };
    const r = link(JSON.stringify({ ops: [recipe, { op: 'add', name: '3 קציצות', recipeId: 'fish-balls', qty: 3 }] }));
    expect(r.status).toBe(0);
    const summary = JSON.parse(r.stdout.trim().split('\n')[1]);
    expect(summary.items).toEqual([expect.objectContaining({ name: '3 קציצות', kcal: 188, protein: 18.1, fat: 7.8 })]);
    expect(summary.totalKcal).toBe(188);
  });

  it('keeps Hebrew apostrophes intact when the JSON comes through a quoted heredoc', () => {
    const json = JSON.stringify({ ops: [{ op: 'add', name: "צ'יפס", kcal: 300 }, { op: 'add', name: "ג'חנון", kcal: 500 }] });
    const cmd = `"${process.execPath}" "${script}" <<'EOF'\n${json}\nEOF\n`;
    const r = spawnSync('bash', ['-c', cmd], { env: { ...process.env, KAL_CONFIG: config }, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(payloadOf(r.stdout).ops.map((o) => (o as { name: string }).name)).toEqual(["צ'יפס", "ג'חנון"]);
  });

  it('SKILL.md passes the JSON through a quoted heredoc, never a single-quoted argument', () => {
    const skill = readFileSync(join(process.cwd(), '.claude/skills/kal/SKILL.md'), 'utf8');
    expect(skill).toContain("link.ts --open <<'EOF'");
    expect(skill).not.toMatch(/link\.ts[^\n]*'[{<]/);
  });

  it('fails on non-JSON input', () => {
    const r = link('not json');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('link error:');
  });
});
