import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideMinus, LucidePlus } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { LinkIntake } from '../../core/link-intake';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { decodePayload, localTime, mergeManual, planWrites, recipesInPayload, rescaleAdd, validatePayload, type AddOp, type Day, type Op } from '../../domain';
import { BulletBar } from '../../shared/bullet-bar';
import { fmt, num, shortDate, warningText } from '../../shared/format';
import { describeOp } from './confirm.logic';

@Component({
  selector: 'app-confirm',
  imports: [BulletBar, LucideMinus, LucidePlus],
  template: `
    @if (error(); as e) {
      <section class="card stack">
        <h2>קישור לא תקין</h2>
        <p class="muted small">{{ e }}</p>
        <button type="button" (click)="cancel()">חזרה</button>
      </section>
    } @else {
      <h2>אישור רישום</h2>
      <div class="stack">
        @for (op of ops(); track $index; let i = $index) {
          @if (op.op === 'add') {
            <article class="card">
              <div class="row"><strong>{{ op.name }}</strong><span class="num">{{ fmt(op.kcal) }}</span></div>
              <div class="muted small num">P {{ fmt(op.protein, 1) }} · C {{ fmt(op.carbs, 1) }} · F {{ fmt(op.fat, 1) }}</div>
              <div class="muted small"><span class="num">{{ shortDate(op.date) }} {{ op.time }}</span></div>
              @if (savedIds().has(op.id)) {
                <span class="alert success small">כבר נשמר</span>
              }
              @if (op.qty !== undefined) {
                <div class="row qty">
                  <span class="muted small">כמות</span>
                  <button type="button" aria-label="פחות" (click)="changeQty(i, -1)"><svg lucideMinus [size]="16"></svg></button>
                  <input class="num qty-input" type="number" inputmode="decimal" aria-label="כמות" [value]="op.qty" (change)="setQty(i, $any($event.target).value)" />
                  <button type="button" aria-label="יותר" (click)="changeQty(i, 1)"><svg lucidePlus [size]="16"></svg></button>
                </div>
              } @else {
                <label>קלוריות<input type="number" inputmode="decimal" aria-label="קלוריות" [value]="op.kcal" (change)="setKcal(i, $any($event.target).value)" /></label>
              }
            </article>
          } @else {
            <p class="card">{{ describe(op) }}</p>
          }
        }
      </div>

      @if (preview(); as p) {
        <section class="preview">
          <div class="muted small">אחרי השמירה</div>
          <app-bullet-bar label="קלוריות" [value]="p.intake.kcal" [target]="p.targetKcal" [max]="p.macros.kcal.max" tone="out" />
          <app-bullet-bar label="חלבון" unit="g" [value]="p.intake.protein" [target]="p.macros.protein.target" [max]="p.macros.protein.max" tone="in" />
          <app-bullet-bar label="פחמימות" unit="g" [value]="p.intake.carbs" [max]="p.macros.carbs.max" />
          <app-bullet-bar label="שומן" unit="g" [value]="p.intake.fat" [max]="p.macros.fat.max" />
          @for (w of p.warnings; track $index) {
            <div class="alert warning">{{ warningText(w) }}</div>
          }
        </section>
      }

      @if (saveError(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
      <div class="row actions">
        <button type="button" class="primary" (click)="save()">שמירה</button>
        <button type="button" (click)="cancel()">ביטול</button>
      </div>
    }
  `,
  styles: `
    .qty { justify-content: flex-start; }
    .qty-input { width: 88px; text-align: center; }
    .preview { margin-block: 16px; }
    .actions button.primary { flex: 1; }
  `,
})
export class Confirm {
  private readonly intake = inject(LinkIntake);
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  protected readonly fmt = fmt;
  protected readonly shortDate = shortDate;
  protected readonly warningText = warningText;

  protected readonly error = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly ops = signal<Op[]>([]);

  constructor() {
    const encoded = this.intake.pending();
    if (!encoded) {
      void this.router.navigateByUrl('/');
      return;
    }
    try {
      this.ops.set(decodePayload(encoded).ops);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  protected readonly savedIds = computed(() => new Set(this.state.entries().map((e) => e.id)));
  private readonly linkRecipes = computed(() => recipesInPayload({ v: 1, ops: this.ops() }));
  private readonly allRecipes = computed(() => [...this.linkRecipes(), ...this.state.recipes()]);

  protected readonly preview = computed(() => {
    const ops = this.ops();
    if (ops.length === 0) return null;
    const writes = planWrites({ v: 1, ops }, { source: 'link', time: localTime(this.state.now()) });
    const date = writes.entries[0]?.date ?? writes.activities[0]?.date ?? writes.weights[0]?.date ?? this.state.today();
    const ids = new Set(writes.entries.map((e) => e.id));
    const entries = [...this.state.entries().filter((e) => !ids.has(e.id)), ...writes.entries];
    const weighIns = [...this.state.weighIns().filter((w) => !writes.weights.some((x) => x.date === w.date)), ...writes.weights];
    const days = new Map<string, Day>(this.state.days().map((d) => [d.date, d]));
    for (const a of writes.activities) {
      const day = days.get(a.date) ?? { date: a.date };
      days.set(a.date, { ...day, manual: mergeManual(day.manual, a) });
    }
    return this.state.dayFor(date, { entries, weighIns, days: [...days.values()] });
  });

  protected describe(op: Op): string {
    return describeOp(op, this.allRecipes());
  }

  private recipeFor(op: AddOp) {
    return this.allRecipes().find((r) => r.id === op.recipeId);
  }

  protected changeQty(index: number, delta: number): void {
    const op = this.ops()[index];
    if (op?.op !== 'add') return;
    const recipe = this.recipeFor(op);
    const step = recipe && !recipe.yield.units ? 10 : 1; // cooked-weight recipes count grams
    this.applyQty(index, (op.qty ?? 1) + delta * step);
  }

  protected setQty(index: number, raw: string): void {
    const qty = num(raw);
    if (qty !== null) this.applyQty(index, qty);
  }

  private applyQty(index: number, qty: number): void {
    if (qty < 0.1) return;
    this.saveError.set(null);
    this.ops.update((ops) => ops.map((op, i) => (i === index && op.op === 'add' ? rescaleAdd(op, this.recipeFor(op), qty) : op)));
  }

  protected setKcal(index: number, raw: string): void {
    const kcal = num(raw);
    if (kcal === null) return;
    this.saveError.set(null);
    this.ops.update((ops) => ops.map((op, i) => (i === index && op.op === 'add' ? ({ ...op, kcal } as AddOp) : op)));
  }

  protected save(): void {
    const uid = this.state.uid();
    if (!uid) return;
    let payload;
    try {
      payload = validatePayload({ v: 1, ops: this.ops() });
    } catch (e) {
      this.saveError.set(`ערך לא תקין: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const writes = planWrites(payload, { source: 'link', time: localTime(this.state.now()) });
    this.repo.applyWrites(uid, writes, this.state.days()).catch(() => this.toast.show('השמירה נכשלה'));
    this.intake.clear();
    this.toast.show('נשמר');
    void this.router.navigateByUrl('/');
  }

  protected cancel(): void {
    this.intake.clear();
    void this.router.navigateByUrl('/');
  }
}
