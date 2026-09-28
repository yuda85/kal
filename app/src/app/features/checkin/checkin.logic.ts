import { CHECKIN_LINK_ID, localTime, type Day, type PlannedWrites, type WeighIn } from '../../domain';

export const CHECKIN_HOUR = '22:00';

export interface CheckInDraft {
  steps: number | null;
  workoutType: string | null;
  workoutKcal: number | null;
  weightKg: number | null;
}

export function shouldPromptCheckIn(now: Date, day: Day | undefined, dismissed: boolean): boolean {
  return !dismissed && !day?.checkedInAt && localTime(now) >= CHECKIN_HOUR;
}

export function initialCheckIn(day: Day | undefined, weighIn: WeighIn | undefined): CheckInDraft {
  const workout = day?.manual?.workouts?.find((w) => w.linkId === CHECKIN_LINK_ID);
  return {
    steps: day?.manual?.steps ?? day?.garmin?.steps ?? null,
    workoutType: workout?.type ?? null,
    workoutKcal: workout?.kcal ?? null,
    weightKg: weighIn?.kg ?? null,
  };
}

export function checkInError(d: CheckInDraft): string | null {
  if (d.steps !== null && (d.steps < 0 || d.steps > 100000)) return 'צעדים: מספר בין 0 ל-100000';
  if (d.workoutType !== null && (d.workoutKcal === null || d.workoutKcal < 0 || d.workoutKcal > 3000)) return 'קלוריות אימון: מספר בין 0 ל-3000';
  if (d.weightKg !== null && (d.weightKg < 30 || d.weightKg > 300)) return 'משקל: מספר בין 30 ל-300';
  return null;
}

export function checkInWrites(d: CheckInDraft, date: string, now: Date): PlannedWrites {
  return {
    entries: [],
    recipes: [],
    weights: d.weightKg !== null ? [{ date, kg: d.weightKg, time: localTime(now) }] : [],
    activities: [
      {
        date,
        linkId: CHECKIN_LINK_ID,
        ...(d.steps !== null ? { steps: d.steps } : {}),
        workouts: d.workoutType !== null ? [{ type: d.workoutType, kcal: d.workoutKcal!, linkId: CHECKIN_LINK_ID }] : [],
      },
    ],
    checkIns: [date],
  };
}
