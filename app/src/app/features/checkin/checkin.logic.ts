import { CHECKIN_LINK_ID, localTime, type Day, type PlannedWrites, type WeighIn } from '../../domain';

export const CHECKIN_HOUR = '22:00';

export interface CheckInDraft {
  steps: number | null;
  workoutType: string | null;
  workoutKcal: number | null;
  /** Optional: with it, the workout's resting share (already in BMR) is taken out. */
  workoutMin: number | null;
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
    workoutMin: workout?.durationMin ?? null,
    weightKg: weighIn?.kg ?? null,
  };
}

export function checkInError(d: CheckInDraft): string | null {
  if (d.steps !== null && (d.steps < 0 || d.steps > 100000)) return 'צעדים: מספר בין 0 ל-100000';
  if (d.workoutType !== null && (d.workoutKcal === null || d.workoutKcal < 0 || d.workoutKcal > 3000)) return 'קלוריות אימון: מספר בין 0 ל-3000';
  if (d.workoutType !== null && d.workoutMin !== null && (d.workoutMin < 1 || d.workoutMin > 600)) return 'משך אימון: בין 1 ל-600 דקות';
  if (d.weightKg !== null && (d.weightKg < 30 || d.weightKg > 300)) return 'משקל: מספר בין 30 ל-300';
  return null;
}

/** With `initial`, only what the owner changed is written, so values saved elsewhere meanwhile survive. */
export function checkInWrites(d: CheckInDraft, date: string, now: Date, initial?: CheckInDraft): PlannedWrites {
  const stepsChanged = d.steps !== null && d.steps !== initial?.steps;
  const workoutChanged =
    !initial || d.workoutType !== initial.workoutType || d.workoutKcal !== initial.workoutKcal || d.workoutMin !== initial.workoutMin;
  const weightChanged = d.weightKg !== null && d.weightKg !== initial?.weightKg;
  return {
    entries: [],
    recipes: [],
    weights: weightChanged ? [{ date, kg: d.weightKg!, time: localTime(now) }] : [],
    activities: [
      {
        date,
        linkId: CHECKIN_LINK_ID,
        ...(stepsChanged ? { steps: d.steps! } : {}),
        ...(workoutChanged
          ? { workouts: d.workoutType !== null ? [{ type: d.workoutType, kcal: d.workoutKcal!, ...(d.workoutMin !== null ? { durationMin: d.workoutMin } : {}), linkId: CHECKIN_LINK_ID }] : [] }
          : {}),
      },
    ],
    checkIns: [date],
  };
}
