import { describe, expect, it } from 'vitest';
import {
  buildUrl,
  decodePayload,
  encodePayload,
  fillDefaults,
  LinkError,
  newLinkId,
  payloadParam,
  pendingRecipeIds,
  recipesInPayload,
  resolveRecipePortions,
  validatePayload,
  type Payload,
} from './link.ts';
import { FISH_BALLS } from './testing.ts';

const add = { op: 'add', id: 'abcd1234', date: '2026-09-27', time: '13:10', name: '3 קציצות דגים', kcal: 450, protein: 36, carbs: 18, fat: 24 } as const;

describe('encode / decode', () => {
  it('round-trips Hebrew with geresh, gershayim, quotes and emoji exactly', () => {
    const payload: Payload = { v: 1, ops: [{ ...add, name: 'צ׳יפס "ביתי" ו־תה״ל 🍟' }] };
    const encoded = encodePayload(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePayload(encoded)).toEqual(payload);
  });

  it('rejects broken encodings and non-JSON', () => {
    expect(() => decodePayload('%%%')).toThrow(LinkError);
    expect(() => decodePayload('bm90IGpzb24')).toThrow(LinkError);
  });

  it('builds a URL and extracts the payload from a hash', () => {
    const url = buildUrl('https://yuda85.github.io/kal/', { v: 1, ops: [add] });
    const hash = new URL(url).hash;
    expect(url.startsWith('https://yuda85.github.io/kal/#p=')).toBe(true);
    expect(decodePayload(payloadParam(hash)!)).toEqual({ v: 1, ops: [add] });
    expect(payloadParam('#x=1')).toBeNull();
    expect(payloadParam('')).toBeNull();
  });
});

describe('validatePayload', () => {
  it('accepts every op type', () => {
    const payload = {
      v: 1,
      ops: [
        add,
        { op: 'recipe', id: 'fish-balls', name: 'קציצות דגים', aliases: ['קציצות'], ingredients: FISH_BALLS, yield: { units: 20, unitName: 'קציצה' } },
        { op: 'weight', date: '2026-09-27', kg: 88.4 },
        { op: 'activity', id: 'act12345', date: '2026-09-27', steps: 9200, workouts: [{ type: 'football', durationMin: 60, kcal: 550 }] },
      ],
    };
    expect(validatePayload(payload)).toEqual(payload);
  });

  it('rejects an unsupported version', () => {
    expect(() => validatePayload({ v: 2, ops: [add] })).toThrow('unsupported version');
  });

  it('rejects values outside the ranges', () => {
    expect(() => validatePayload({ v: 1, ops: [{ ...add, kcal: 6000 }] })).toThrow('kcal');
    expect(() => validatePayload({ v: 1, ops: [{ ...add, protein: -1 }] })).toThrow('protein');
    expect(() => validatePayload({ v: 1, ops: [{ op: 'weight', date: '2026-09-27', kg: 20 }] })).toThrow('kg');
  });

  it('rejects bad dates, times, ids and names', () => {
    expect(() => validatePayload({ v: 1, ops: [{ ...add, date: '2026-02-30' }] })).toThrow('date');
    expect(() => validatePayload({ v: 1, ops: [{ ...add, time: '24:00' }] })).toThrow('time');
    expect(() => validatePayload({ v: 1, ops: [{ ...add, id: 'X!' }] })).toThrow('id');
    expect(() => validatePayload({ v: 1, ops: [{ ...add, name: '   ' }] })).toThrow('name');
  });

  it('rejects unknown ops, empty activity, and recipes without a yield', () => {
    expect(() => validatePayload({ v: 1, ops: [{ op: 'delete' }] })).toThrow('unknown');
    expect(() => validatePayload({ v: 1, ops: [{ op: 'activity', date: '2026-09-27' }] })).toThrow('steps or workouts');
    const recipe = { op: 'recipe', id: 'fish-balls', name: 'x', aliases: [], ingredients: FISH_BALLS, yield: {} };
    expect(() => validatePayload({ v: 1, ops: [recipe] })).toThrow('yield');
  });

  it('rejects impossible per-100 g values', () => {
    const bad = [{ name: 'oil', grams: 10, per100: { kcal: 1000, protein: 0, carbs: 0, fat: 100 } }];
    const recipe = { op: 'recipe', id: 'r1', name: 'x', aliases: [], ingredients: bad, yield: { units: 1 } };
    expect(() => validatePayload({ v: 1, ops: [recipe] })).toThrow('per100');
  });

  it('requires an id on activity ops', () => {
    expect(() => validatePayload({ v: 1, ops: [{ op: 'activity', date: '2026-09-27', steps: 10 }] })).toThrow('ops[0].id is invalid');
  });

  it('rejects an empty op list', () => {
    expect(() => validatePayload({ v: 1, ops: [] })).toThrow('ops');
  });

  it('rejects unknown fields by name so typos cannot silently drop data', () => {
    expect(() => validatePayload({ v: 1, ops: [{ ...add, carb: 5 }] })).toThrow('ops[0].carb is not a known field');
    expect(() => validatePayload({ v: 1, ops: [add], extra: true })).toThrow('extra is not a known field');
    const typoIngredient = [{ name: 'oil', grams: 10, per100: { kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0 } }];
    const recipe = { op: 'recipe', id: 'r1', name: 'x', aliases: [], ingredients: typoIngredient, yield: { units: 1 } };
    expect(() => validatePayload({ v: 1, ops: [recipe] })).toThrow('per100.fibre is not a known field');
  });

  it('rejects a __proto__ key coming from JSON', () => {
    const raw = JSON.parse('{"v":1,"ops":[{"op":"weight","date":"2026-09-27","kg":80,"__proto__":{"x":1}}]}');
    expect(() => validatePayload(raw)).toThrow('__proto__ is not a known field');
  });

  it('returns a fresh copy, not the input object', () => {
    const input = { v: 1, ops: [{ ...add }] };
    const out = validatePayload(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out.ops[0]).not.toBe(input.ops[0]);
  });

  it('accepts a workout without a duration', () => {
    const op = { op: 'activity', id: 'checkin', date: '2026-09-27', workouts: [{ type: 'Push', kcal: 350 }] };
    expect(validatePayload({ v: 1, ops: [op] })).toEqual({ v: 1, ops: [op] });
  });
});

describe('video op', () => {
  const video = { op: 'video', id: 'vid12345', url: 'https://www.instagram.com/reel/abc/', title: 'למה רעבים בערב', take: 'לסגור מטבח ב-21:00', topic: 'hunger' } as const;

  it('accepts a video with an https url, a title, a take and a topic', () => {
    expect(validatePayload({ v: 1, ops: [video] }).ops[0]).toEqual(video);
  });

  it('rejects a non-https url, an unknown topic, a long take and unknown fields', () => {
    expect(() => validatePayload({ v: 1, ops: [{ ...video, url: 'http://instagram.com/reel/abc' }] })).toThrow(/url/);
    expect(() => validatePayload({ v: 1, ops: [{ ...video, url: 'javascript:alert(1)' }] })).toThrow(/url/);
    expect(() => validatePayload({ v: 1, ops: [{ ...video, topic: 'pizza' }] })).toThrow(/topic/);
    expect(() => validatePayload({ v: 1, ops: [{ ...video, take: 'א'.repeat(281) }] })).toThrow(/take/);
    expect(() => validatePayload({ v: 1, ops: [{ ...video, tip: 'x' }] })).toThrow(/tip is not a known field/);
  });

  it('gets an id from fillDefaults', () => {
    const { id: _, ...draft } = video;
    const p = fillDefaults({ ops: [draft] }, new Date('2026-09-30T10:00:00Z'), () => 'new12345') as Payload;
    expect(p.ops[0]).toEqual({ ...video, id: 'new12345' });
  });
});

describe('fillDefaults', () => {
  const now = new Date('2026-09-26T21:30:00Z');

  it('fills id, Israeli date and time, and the version', () => {
    const p = fillDefaults({ ops: [{ op: 'add', name: 'שקשוקה', kcal: 420 }, { op: 'weight', kg: 88.4 }] }, now, () => 'abcd1234') as Payload;
    expect(p.v).toBe(1);
    expect(p.ops[0]).toEqual({ op: 'add', id: 'abcd1234', date: '2026-09-27', time: '00:30', name: 'שקשוקה', kcal: 420 });
    expect(p.ops[1]).toEqual({ op: 'weight', date: '2026-09-27', kg: 88.4 });
  });

  it('never overwrites a date, time or id that was provided', () => {
    const p = fillDefaults({ ops: [{ op: 'add', id: 'keepme12', date: '2026-09-26', time: '21:00', name: 'אתמול', kcal: 300 }] }, now, () => 'zzzz9999') as Payload;
    expect(p.ops[0]).toMatchObject({ id: 'keepme12', date: '2026-09-26', time: '21:00' });
  });

  it('gives activity ops an id', () => {
    const p = fillDefaults({ ops: [{ op: 'activity', steps: 9000 }] }, now, () => 'act99999') as Payload;
    expect(p.ops[0]).toEqual({ op: 'activity', id: 'act99999', date: '2026-09-27', steps: 9000 });
  });

  it('rejects a draft without ops', () => {
    expect(() => fillDefaults({}, now, () => 'abcd1234')).toThrow(LinkError);
  });
});

describe('newLinkId', () => {
  it('makes 8 lowercase base36 characters', () => {
    expect(newLinkId()).toMatch(/^[a-z0-9]{8}$/);
  });
});

describe('recipe portions', () => {
  const recipe = { id: 'fish-balls', name: 'קציצות דגים', aliases: [], ingredients: FISH_BALLS, yield: { units: 20 } };
  const pending = { v: 1, ops: [{ op: 'add', id: 'abcd1234', date: '2026-09-27', time: '13:10', name: '3 קציצות', recipeId: 'fish-balls', qty: 3 }] };

  it('lists recipe ids that still need numbers', () => {
    expect(pendingRecipeIds(pending)).toEqual(['fish-balls']);
    expect(pendingRecipeIds({ v: 1, ops: [add] })).toEqual([]);
  });

  it('fills kcal and macros from the recipe', () => {
    const p = resolveRecipePortions(pending, [recipe]) as Payload;
    expect(p.ops[0]).toMatchObject({ kcal: 188, protein: 18.1, fat: 7.8 });
    expect(p.ops[0]).toHaveProperty('carbs');
  });

  it('keeps numbers that were given explicitly', () => {
    const explicit = { v: 1, ops: [{ ...pending.ops[0], kcal: 200 }] };
    expect((resolveRecipePortions(explicit, [recipe]) as Payload).ops[0]).toMatchObject({ kcal: 200 });
  });

  it('fails on an unknown recipe or a missing qty', () => {
    expect(() => resolveRecipePortions(pending, [])).toThrow('unknown recipe: fish-balls');
    const noQty = { v: 1, ops: [{ ...pending.ops[0], qty: undefined }] };
    expect(() => resolveRecipePortions(noQty, [recipe])).toThrow('qty');
  });

  it('reads recipe ops from the same payload', () => {
    const withRecipe = { v: 1, ops: [{ op: 'recipe', ...recipe }, ...pending.ops] };
    expect(recipesInPayload(withRecipe).map((r) => r.id)).toEqual(['fish-balls']);
  });
});
