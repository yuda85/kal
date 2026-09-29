import { Component, computed, inject, signal } from '@angular/core';
import { LucideImagePlus, LucideX } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { settingsOf, weightOn, WORKOUT_TYPES } from '../../domain';
import { dayLetter, fmt, num, shortDate } from '../../shared/format';
import { checkInError, checkInWrites, initialCheckIn, type CheckInDraft } from './checkin.logic';
import { loadPhoto, savePhoto, shrinkPhoto } from './checkin-photo';
import { CheckInService } from './checkin.service';

@Component({
  selector: 'app-checkin',
  imports: [LucideImagePlus, LucideX],
  template: `
    <div class="backdrop" (click)="later()"></div>
    <section class="sheet card stack" role="dialog" aria-modal="true" aria-label="סגירת יום">
      <div class="row">
        <strong>סגירת יום · {{ title() }}</strong>
        <button type="button" class="icon" aria-label="סגירה" (click)="later()"><svg lucideX [size]="18"></svg></button>
      </div>

      <section class="honest">
        <div class="stack tight">
          <strong>תהיה כנה</strong>
          <p>יש משהו שלא הוספת היום? משהו שהתחמקת מלהוסיף? ביס בדרך, שתייה, רוטב, שמן בטיגון: גם הם נחשבים.</p>
          <p class="muted small">המטרה היא מעקב, לא שיפוט. מספר אמיתי עוזר יותר ממספר יפה.</p>
        </div>
        <div class="photo">
          @if (photo(); as src) {
            <img [src]="src" alt="התמונה שבחרת לסגירת היום" />
            <button type="button" class="link" (click)="picker.click()">החלפת תמונה</button>
          } @else {
            <button type="button" class="add-photo" (click)="picker.click()"><svg lucideImagePlus [size]="20"></svg>הוספת תמונה</button>
          }
          <input #picker type="file" accept="image/*" hidden (change)="choosePhoto($event)" />
        </div>
      </section>
      @if (food(); as f) {
        <p class="alert" [class.neutral]="f.ok" [class.danger]="!f.ok">{{ f.text }}</p>
      }

      <label>צעדים היום
        <input name="steps" type="number" inputmode="numeric" [placeholder]="stepsHint()" [value]="draft().steps ?? ''" (input)="patch('steps', num($any($event.target).value))" />
      </label>

      <div class="stack tight">
        <span class="label">אימון היום?</span>
        <div class="chips">
          <button type="button" class="chip" [class.on]="draft().workoutType === null" (click)="patch('workoutType', null)">בלי אימון</button>
          @for (t of types; track t) {
            <button type="button" class="chip" [attr.data-type]="t" [class.on]="draft().workoutType === t" (click)="patch('workoutType', t)">{{ t }}</button>
          }
        </div>
      </div>
      @if (draft().workoutType !== null) {
        <div class="grid">
          <label>קלוריות מ-Garmin
            <input name="workoutKcal" type="number" inputmode="decimal" [value]="draft().workoutKcal ?? ''" (input)="patch('workoutKcal', num($any($event.target).value))" />
          </label>
          <label>משך (דק׳)
            <input name="workoutMin" type="number" inputmode="numeric" [value]="draft().workoutMin ?? ''" (input)="patch('workoutMin', num($any($event.target).value))" />
          </label>
        </div>
        <p class="muted small hint">יש "קלוריות פעילות"? הזן אותן בלי משך. אחרת הזן את סך הקלוריות ואת המשך, וחלק המנוחה ירד.</p>
        @if (draft().workoutType === 'Cardio') {
          <p class="muted small hint">הליכה או ריצה? הצעדים שלה כבר נספרים בצעדים היומיים. רשום כאן רק אימון שאינו צעדים (אופניים, חתירה, שחייה).</p>
        }
      }

      <label>משקל (לא חובה)
        <input name="weight" type="number" inputmode="decimal" [placeholder]="weightHint()" [value]="draft().weightKg ?? ''" (input)="patch('weightKg', num($any($event.target).value))" />
      </label>

      @if (error(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
      <div class="row">
        <button type="button" data-action="later" (click)="later()">לא עכשיו</button>
        <button type="button" class="primary" (click)="save()">שמירה</button>
      </div>
    </section>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.35); z-index: 10; }
    .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; max-width: 480px; margin-inline: auto; z-index: 11;
      border-radius: 20px 20px 0 0; padding-block-end: calc(16px + env(safe-area-inset-bottom)); max-height: 90dvh; overflow-y: auto; }
    .tight { gap: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .hint { margin: 0; }
    .label { font-size: 13px; color: var(--fg-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { min-height: 44px; border-radius: 999px; padding: 0 12px; font-size: 13px; }
    .chip.on { background: var(--primary); color: var(--on-primary); border-color: transparent; }
    .icon { border: none; background: none; }
    .honest { display: flex; gap: 12px; align-items: flex-start; }
    .honest > .stack { flex: 1; min-width: 0; }
    .honest p { margin: 0; }
    .photo { flex: none; width: 96px; display: grid; justify-items: center; }
    .photo img, .add-photo { width: 96px; aspect-ratio: 9 / 16; border-radius: var(--radius); }
    .photo img { display: block; object-fit: cover; }
    .add-photo { display: grid; place-content: center; justify-items: center; gap: 4px; padding: 4px; border-style: dashed; color: var(--fg-muted); font-size: 12px; }
    .link { border: none; background: none; padding: 0 4px; color: var(--fg-muted); font-size: 12px; }
  `,
})
export class CheckIn {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  private readonly service = inject(CheckInService);
  protected readonly types = WORKOUT_TYPES;
  protected readonly num = num;

  private readonly date = this.state.today();
  private readonly initial = initialCheckIn(this.state.todayDay(), this.state.todayWeighIn());
  protected readonly draft = signal<CheckInDraft>({ ...this.initial });
  protected readonly error = signal<string | null>(null);
  protected readonly title = computed(() => `${dayLetter(this.date)} ${shortDate(this.date)}`);
  protected readonly stepsHint = computed(() => {
    const profile = this.state.profile();
    return profile ? `${fmt(settingsOf(profile).defaultSteps)} אם לא תזין` : '';
  });
  protected readonly photo = signal(loadPhoto());

  protected async choosePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const dataUrl = await shrinkPhoto(file);
      this.photo.set(dataUrl);
      if (!savePhoto(dataUrl)) this.toast.show('התמונה לא נשמרה במכשיר');
    } catch {
      this.toast.show('לא הצלחתי לפתוח את התמונה');
    }
  }

  /** A day without a weigh-in counts the previous one; say which. */
  protected readonly weightHint = computed(() => {
    const w = weightOn(this.state.weighIns(), this.date);
    return w?.carried ? `${fmt(w.kg, 1)} אם לא תזין` : '';
  });
  protected readonly food = computed(() => {
    const s = this.state.todaySummary();
    const profile = this.state.profile();
    if (!s || !profile) return null;
    const settings = settingsOf(profile);
    if (s.intake.kcal >= settings.lowDayThresholdKcal) return { ok: true, text: `אוכל: נרשמו ${fmt(s.intake.kcal)} קל׳ היום` };
    return { ok: false, text: `נרשמו רק ${fmt(s.intake.kcal)} קל׳. אם לא תזין, היום ייחשב ${fmt(settings.missingDayKcal)}` };
  });

  protected patch<K extends keyof CheckInDraft>(key: K, value: CheckInDraft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
    this.error.set(null);
  }

  protected save(): void {
    const uid = this.state.uid();
    if (!uid) return;
    const draft = this.draft();
    const error = checkInError(draft);
    this.error.set(error);
    if (error) return;
    this.state.refreshNow();
    // Only changed values are written: an unchanged weight keeps its morning time, and data saved elsewhere survives.
    this.repo.applyWrites(uid, checkInWrites(draft, this.date, this.state.now(), this.initial), this.state.days()).catch(() => this.toast.show('השמירה נכשלה'));
    this.toast.show('נשמר');
    this.service.dismiss(this.date);
  }

  protected later(): void {
    this.service.dismiss(this.date);
  }
}
