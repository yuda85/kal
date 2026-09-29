import type { DaySummary } from './summary.ts';
import { TIP_TOPICS, TIPS, type Tip, type TipTopic } from './tips-data.ts';

export interface TipState {
  starred: string[];
  /** How many rotation tips were closed; the next one is `TIP_ROTATION[rotation % length]`. */
  rotation: number;
  lastDate?: string;
  lastTipId?: string;
  /** The latest shown tip ids, newest first. */
  recent: string[];
}

export const EMPTY_TIP_STATE: TipState = { starred: [], rotation: 0, recent: [] };
export const RECENT_TIPS = 14;

export type TipReasonCode = 'not_logged' | 'kcal_over' | 'fat_over' | 'carbs_over' | 'protein_low';

export interface TipReason {
  code: TipReasonCode;
  topic: TipTopic;
  value?: number;
  target?: number;
}

export interface DailyTip {
  tip: Tip;
  reason: TipReason | null;
}

/** Topics take turns, so consecutive days never repeat a topic: 1st of each topic, then 2nd of each, and so on. */
export const TIP_ROTATION: Tip[] = (() => {
  const byTopic = TIP_TOPICS.map((topic) => TIPS.filter((t) => t.topic === topic));
  const longest = Math.max(...byTopic.map((list) => list.length));
  const out: Tip[] = [];
  for (let i = 0; i < longest; i++) for (const list of byTopic) if (list[i]) out.push(list[i]);
  return out;
})();

/** A strong reason from yesterday's finished day, or null; checked in the §17 order. */
export function tipReason(yesterday: DaySummary | null): TipReason | null {
  if (!yesterday) return null;
  if (yesterday.imputed) return { code: 'not_logged', topic: 'tracking' };
  const kcal = yesterday.intake.kcal;
  if (kcal > yesterday.targetKcal + 300) return { code: 'kcal_over', topic: 'hunger', value: kcal, target: yesterday.targetKcal };
  const { fat, carbs, protein } = yesterday.macros;
  if (fat.target > 0 && fat.value > fat.target * 1.2) return { code: 'fat_over', topic: 'fat', value: fat.value, target: fat.target };
  if (carbs.target > 0 && carbs.value > carbs.target * 1.2) return { code: 'carbs_over', topic: 'carbs', value: carbs.value, target: carbs.target };
  if (protein.target > 0 && protein.value < protein.target * 0.7) return { code: 'protein_low', topic: 'protein', value: protein.value, target: protein.target };
  return null;
}

export function pickDailyTip(state: TipState, reason: TipReason | null): DailyTip {
  if (reason) {
    const topicTips = TIPS.filter((t) => t.topic === reason.topic);
    return { tip: topicTips.find((t) => !state.recent.includes(t.id)) ?? topicTips[0], reason };
  }
  return { tip: TIP_ROTATION[state.rotation % TIP_ROTATION.length], reason: null };
}

/** The state after the owner closes today's tip; only a rotation tip advances the rotation. */
export function closeDailyTip(state: TipState, pick: DailyTip, today: string): TipState {
  return {
    ...state,
    rotation: pick.reason ? state.rotation : state.rotation + 1,
    lastDate: today,
    lastTipId: pick.tip.id,
    recent: [pick.tip.id, ...state.recent.filter((id) => id !== pick.tip.id)].slice(0, RECENT_TIPS),
  };
}

export function toggleStar(state: TipState, id: string): TipState {
  const starred = state.starred.includes(id) ? state.starred.filter((s) => s !== id) : [...state.starred, id];
  return { ...state, starred };
}

export function videoPlatform(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\.|^m\./, '');
  } catch {
    return '';
  }
  if (host.endsWith('instagram.com')) return 'Instagram';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
  if (host.endsWith('tiktok.com')) return 'TikTok';
  if (host.endsWith('facebook.com') || host === 'fb.watch') return 'Facebook';
  return host;
}
