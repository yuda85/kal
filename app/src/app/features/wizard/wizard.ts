import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { localTime, newLinkId } from '../../domain';
import { fmt, num, shortDate } from '../../shared/format';
import { buildSetup, initialForm, previewSetup, validateStep, type ConstraintFields, type SetupForm } from './setup';

const STEPS = ['פרופיל', 'יעד', 'מגבלות', 'סיכום'];

@Component({
  selector: 'app-wizard',
  template: `
    <section class="stack wizard">
      <h1>{{ steps[step()] }}</h1>
      <p class="muted small">שלב {{ step() + 1 }} מתוך {{ steps.length }}</p>

      @switch (step()) {
        @case (0) {
          <label>מין
            <select [value]="form().sex" (change)="set('sex', $any($event.target).value)">
              <option value="male">זכר</option><option value="female">נקבה</option>
            </select>
          </label>
          <label>תאריך לידה<input type="date" [value]="form().birthDate" (input)="set('birthDate', $any($event.target).value)" /></label>
          <label>גובה (ס״מ)<input type="number" inputmode="decimal" [value]="form().heightCm ?? ''" (input)="set('heightCm', num($any($event.target).value))" /></label>
          <label>משקל נוכחי (ק״ג)<input type="number" inputmode="decimal" [value]="form().currentWeightKg ?? ''" (input)="set('currentWeightKg', num($any($event.target).value))" /></label>
          <label>אחוז שומן (לא חובה)<input type="number" inputmode="decimal" [value]="form().bodyFatPct ?? ''" (input)="set('bodyFatPct', num($any($event.target).value))" /></label>
        }
        @case (1) {
          <label>משקל יעד (ק״ג)<input type="number" inputmode="decimal" [value]="form().targetWeightKg ?? ''" (input)="set('targetWeightKg', num($any($event.target).value))" /></label>
          <label>קצב
            <select [value]="form().preset" (change)="set('preset', $any($event.target).value)">
              <option value="relaxed">רגוע (0.5% בשבוע)</option><option value="aggressive">אגרסיבי (1% בשבוע)</option><option value="custom">מותאם</option>
            </select>
          </label>
          @if (form().preset === 'custom') {
            <label>ק״ג בשבוע<input type="number" inputmode="decimal" [value]="form().customPaceKgPerWeek ?? ''" (input)="set('customPaceKgPerWeek', num($any($event.target).value))" /></label>
          }
        }
        @case (2) {
          <p class="muted small">מלא רק מה שרלוונטי, למשל תקרת חלבון.</p>
          <div class="grid">
            <label>קלוריות מינ׳<input type="number" inputmode="decimal" [value]="form().constraints.kcalMin ?? ''" (input)="setC('kcalMin', $any($event.target).value)" /></label>
            <label>קלוריות מקס׳<input type="number" inputmode="decimal" [value]="form().constraints.kcalMax ?? ''" (input)="setC('kcalMax', $any($event.target).value)" /></label>
            <label>חלבון מינ׳ (ג׳)<input type="number" inputmode="decimal" [value]="form().constraints.proteinMin ?? ''" (input)="setC('proteinMin', $any($event.target).value)" /></label>
            <label>חלבון מקס׳ (ג׳)<input type="number" inputmode="decimal" [value]="form().constraints.proteinMax ?? ''" (input)="setC('proteinMax', $any($event.target).value)" /></label>
            <label>פחמימות מקס׳ (ג׳)<input type="number" inputmode="decimal" [value]="form().constraints.carbsMax ?? ''" (input)="setC('carbsMax', $any($event.target).value)" /></label>
            <label>שומן מקס׳ (ג׳)<input type="number" inputmode="decimal" [value]="form().constraints.fatMax ?? ''" (input)="setC('fatMax', $any($event.target).value)" /></label>
          </div>
        }
        @case (3) {
          @if (preview(); as p) {
            <dl class="card summary">
              <div class="row"><dt>BMR</dt><dd class="num">{{ fmt(p.bmrKcal) }}</dd></div>
              <div class="row"><dt>גירעון יומי</dt><dd class="num">{{ fmt(p.deficitKcal) }}</dd></div>
              <div class="row"><dt>יעד יומי טיפוסי</dt><dd class="num">{{ fmt(p.typicalTargetKcal) }}</dd></div>
              <div class="row"><dt>הגעה צפויה</dt><dd class="num">{{ shortDate(p.etaDate) }}</dd></div>
            </dl>
          }
        }
      }

      @if (stepError(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
      @if (saveError(); as e) {
        <p class="alert danger" role="alert">{{ e }}</p>
      }
      @if (permissionUid(); as uid) {
        <div class="alert warning" role="alert">
          אין עדיין הרשאת כתיבה. ב-Firebase console צור מסמך <strong>owners/{{ uid }}</strong> (עם שדה כלשהו) ונסה שוב.
          <div class="num small">uid: {{ uid }}</div>
        </div>
      }

      <div class="row actions">
        @if (step() > 0) {
          <button type="button" (click)="back()">חזרה</button>
        }
        @if (step() === 2) {
          <button type="button" (click)="skip()">דלג</button>
        }
        @if (step() < steps.length - 1) {
          <button class="primary" type="button" (click)="next()">המשך</button>
        } @else {
          <button class="primary" type="button" [disabled]="saving()" (click)="save()">{{ saving() ? 'שומר…' : 'שמירה' }}</button>
        }
      </div>
    </section>
  `,
  styles: `
    .wizard { max-width: 480px; margin: 0 auto; padding: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .summary dt { color: var(--fg-muted); }
    .summary dd { margin: 0; }
    .actions { justify-content: flex-end; }
  `,
})
export class Wizard {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly router = inject(Router);

  protected readonly steps = STEPS;
  protected readonly fmt = fmt;
  protected readonly num = num;
  protected readonly shortDate = shortDate;

  private readonly latestKg = [...this.state.weighIns()].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? null;
  readonly step = signal(0);
  readonly form = signal<SetupForm>(initialForm(this.state.profile(), this.state.goal(), this.latestKg));
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly permissionUid = signal<string | null>(null);
  protected readonly stepError = signal<string | null>(null);
  protected readonly preview = computed(() => previewSetup(this.form(), this.state.today()));

  protected set<K extends keyof SetupForm>(key: K, value: SetupForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
    this.stepError.set(null);
  }

  protected setC(key: keyof ConstraintFields, raw: string): void {
    this.form.update((f) => ({ ...f, constraints: { ...f.constraints, [key]: num(raw) } }));
    this.stepError.set(null);
  }

  protected next(): void {
    const error = validateStep(this.step(), this.form(), this.state.today());
    this.stepError.set(error);
    if (!error) this.step.update((s) => s + 1);
  }

  protected back(): void {
    this.stepError.set(null);
    this.step.update((s) => s - 1);
  }

  protected skip(): void {
    this.stepError.set(null);
    this.form.update((f) => ({ ...f, constraints: initialForm(this.state.profile(), null, null).constraints }));
    this.step.update((s) => s + 1);
  }

  async save(): Promise<void> {
    const uid = this.state.uid();
    if (!uid) return;
    this.saveError.set(null);
    this.permissionUid.set(null);
    let setup;
    try {
      setup = buildSetup(this.form(), {
        today: this.state.today(),
        time: localTime(this.state.now()),
        goalId: newLinkId(),
        previousGoal: this.state.goal(),
        previousProfile: this.state.profile(),
        latestKg: this.latestKg,
      });
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : String(e));
      return;
    }
    this.saving.set(true);
    try {
      await this.repo.saveSetup(uid, setup);
      await this.router.navigateByUrl('/');
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') this.permissionUid.set(uid);
      else this.saveError.set('השמירה נכשלה. בדוק חיבור ונסה שוב.');
    } finally {
      this.saving.set(false);
    }
  }
}
