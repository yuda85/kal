import { describe, expect, it } from 'vitest';
import type { DaySummary } from './summary.ts';
import { TIP_TOPICS, TIPS } from './tips-data.ts';
import { closeDailyTip, EMPTY_TIP_STATE, pickDailyTip, RECENT_TIPS, TIP_ROTATION, tipReason, toggleStar, videoPlatform } from './tips.ts';

function day(over: { imputed?: boolean; kcal?: number; target?: number; fat?: number; carbs?: number; protein?: number } = {}): DaySummary {
  const line = (value: number, target: number) => ({ value, target, min: null, max: null });
  return {
    imputed: over.imputed ?? false,
    intake: { kcal: over.kcal ?? 2000, protein: 0, carbs: 0, fat: 0, kcalWithoutMacros: 0 },
    targetKcal: over.target ?? 2000,
    macros: {
      kcal: line(over.kcal ?? 2000, over.target ?? 2000),
      protein: line(over.protein ?? 160, 160),
      carbs: line(over.carbs ?? 200, 200),
      fat: line(over.fat ?? 70, 70),
    },
  } as unknown as DaySummary;
}

describe('tips data', () => {
  it('has 50 tips with unique ids, every topic covered', () => {
    expect(TIPS).toHaveLength(50);
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(50);
    for (const topic of TIP_TOPICS) expect(TIPS.some((t) => t.topic === topic)).toBe(true);
  });

  it('rotates through every tip without two of a topic in a row at the start', () => {
    expect(new Set(TIP_ROTATION.map((t) => t.id)).size).toBe(50);
    expect(TIP_ROTATION.slice(0, TIP_TOPICS.length).map((t) => t.topic)).toEqual([...TIP_TOPICS]);
  });
});

describe('tipReason', () => {
  it('is null without a day or when the day was fine', () => {
    expect(tipReason(null)).toBeNull();
    expect(tipReason(day())).toBeNull();
  });

  it('checks the reasons in order: not logged, calories, fat, carbs, protein', () => {
    expect(tipReason(day({ imputed: true, kcal: 3000, fat: 200 }))?.code).toBe('not_logged');
    expect(tipReason(day({ kcal: 2301, fat: 200 }))).toEqual({ code: 'kcal_over', topic: 'hunger', value: 2301, target: 2000 });
    expect(tipReason(day({ kcal: 2300, fat: 85, carbs: 300 }))).toEqual({ code: 'fat_over', topic: 'fat', value: 85, target: 70 });
    expect(tipReason(day({ carbs: 241, protein: 10 }))?.code).toBe('carbs_over');
    expect(tipReason(day({ protein: 111 }))).toEqual({ code: 'protein_low', topic: 'protein', value: 111, target: 160 });
  });

  it('needs more than the thresholds', () => {
    expect(tipReason(day({ kcal: 2300 }))).toBeNull();
    expect(tipReason(day({ fat: 84 }))).toBeNull();
    expect(tipReason(day({ protein: 112 }))).toBeNull();
  });
});

describe('daily tip', () => {
  it('follows the rotation and advances it on close', () => {
    const first = pickDailyTip(EMPTY_TIP_STATE, null);
    expect(first).toEqual({ tip: TIP_ROTATION[0], reason: null });
    const next = closeDailyTip(EMPTY_TIP_STATE, first, '2026-09-30');
    expect(next).toMatchObject({ rotation: 1, lastDate: '2026-09-30', lastTipId: TIP_ROTATION[0].id, recent: [TIP_ROTATION[0].id] });
    expect(pickDailyTip(next, null).tip).toBe(TIP_ROTATION[1]);
  });

  it('wraps around after the last tip', () => {
    expect(pickDailyTip({ ...EMPTY_TIP_STATE, rotation: 50 }, null).tip).toBe(TIP_ROTATION[0]);
  });

  it('picks a reason tip from its topic, skipping recent ones, without advancing the rotation', () => {
    const reason = { code: 'fat_over' as const, topic: 'fat' as const, value: 90, target: 70 };
    const fatTips = TIPS.filter((t) => t.topic === 'fat');
    const state = { ...EMPTY_TIP_STATE, rotation: 7, recent: [fatTips[0].id] };
    const pick = pickDailyTip(state, reason);
    expect(pick).toEqual({ tip: fatTips[1], reason });
    expect(closeDailyTip(state, pick, '2026-09-30').rotation).toBe(7);
  });

  it('repeats the first tip of a topic when all were recent', () => {
    const fatTips = TIPS.filter((t) => t.topic === 'fat');
    const pick = pickDailyTip({ ...EMPTY_TIP_STATE, recent: fatTips.map((t) => t.id) }, { code: 'fat_over', topic: 'fat' });
    expect(pick.tip).toBe(fatTips[0]);
  });

  it('keeps a short recent list, newest first', () => {
    let state = EMPTY_TIP_STATE;
    for (let i = 0; i < 20; i++) state = closeDailyTip(state, pickDailyTip(state, null), `2026-10-${String(i + 1).padStart(2, '0')}`);
    expect(state.recent).toHaveLength(RECENT_TIPS);
    expect(state.recent[0]).toBe(TIP_ROTATION[19].id);
  });
});

describe('stars and videos', () => {
  it('toggles a star', () => {
    const on = toggleStar(EMPTY_TIP_STATE, 'sauce-side');
    expect(on.starred).toEqual(['sauce-side']);
    expect(toggleStar(on, 'sauce-side').starred).toEqual([]);
  });

  it('names the video platform', () => {
    expect(videoPlatform('https://www.instagram.com/reel/abc/')).toBe('Instagram');
    expect(videoPlatform('https://youtu.be/xyz')).toBe('YouTube');
    expect(videoPlatform('https://m.youtube.com/shorts/xyz')).toBe('YouTube');
    expect(videoPlatform('https://vm.tiktok.com/abc')).toBe('TikTok');
    expect(videoPlatform('https://example.org/v')).toBe('example.org');
    expect(videoPlatform('not a url')).toBe('');
  });
});
