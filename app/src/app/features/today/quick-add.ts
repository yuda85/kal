import { Component, inject, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { localTime, newLinkId, planWrites, validatePayload, type Payload } from '../../domain';
import { num } from '../../shared/format';
import { activityError, activityPayload, editedEntry, mealError, mealPayload, weightError, weightPayload, type ActivityDraft, type MealDraft } from './quick-add.logic';
import { QuickAddService, type QuickAddTab } from './quick-add.service';

@Component({
  selector: 'app-quick-add',
  imports: [LucideX],
  template: `
    <div class="backdrop" (click)="quickAdd.close()"></div>
    <section class="sheet card stack" role="dialog" aria-label="הוספה מהירה">
      <div class="row">
        <div class="tabs" role="tablist">
          @for (t of tabs; track t.id) {
            <button type="button" role="tab" [class.on]="quickAdd.tab() === t.id" [attr.aria-selected]="quickAdd.tab() === t.id" [disabled]="!!quickAdd.editing()" (click)="switchTab(t.id)">{{ t.label }}</button>
          }
        </div>
        <button type="button" class="icon" aria-label="סגירה" (click)="quickAdd.close()"><svg lucideX [size]="18"></svg></button>
      </div>

      @switch (quickAdd.tab()) {
        @case ('meal') {
          <label>שם (לא חובה)<input name="name" maxlength="100" [value]="meal().name" (input)="patchMeal('name', $any($event.target).value)" /></label>
          <label>קלוריות<input name="kcal" type="number" inputmode="decimal" [value]="meal().kcal ?? ''" (input)="patchMeal('kcal', num($any($event.target).value))" /></label>
          @if (showMacros()) {
            <div class="grid">
              <label>חלבון<input name="protein" type="number" inputmode="decimal" [value]="meal().protein ?? ''" (input)="patchMeal('protein', num($any($event.target).value))" /></label>
              <label>פחמימות<input name="carbs" type="number" inputmode="decimal" [value]="meal().carbs ?? ''" (input)="patchMeal('carbs', num($any($event.target).value))" /></label>
              <label>שומן<input name="fat" type="number" inputmode="decimal" [value]="meal().fat ?? ''" (input)="patchMeal('fat', num($any($event.target).value))" /></label>
            </div>
          } @else {
            <button type="button" class="link" (click)="showMacros.set(true)">+ מאקרו</button>
          }
        }
        @case ('weight') {
          <label>משקל (ק״ג)<input name="kg" type="number" inputmode="decimal" [value]="kg() ?? ''" (input)="kg.set(num($any($event.target).value))" /></label>
        }
        @case ('activity') {
          <label>צעדים<input name="steps" type="number" inputmode="numeric" [value]="activity().steps ?? ''" (input)="patchActivity('steps', num($any($event.target).value))" /></label>
          <label>סוג אימון<input name="type" maxlength="40" [value]="activity().type" (input)="patchActivity('type', $any($event.target).value)" /></label>
          <div class="grid">
            <label>דקות<input name="minutes" type="number" inputmode="numeric" [value]="activity().minutes ?? ''" (input)="patchActivity('minutes', num($any($event.target).value))" /></label>
            <label>קלוריות<input name="workoutKcal" type="number" inputmode="decimal" [value]="activity().kcal ?? ''" (input)="patchActivity('kcal', num($any($event.target).value))" /></label>
          </div>
        }
      }

      @if (error(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
      <div class="row">
        @if (quickAdd.editing()) {
          <button type="button" class="danger" (click)="remove()">מחיקה</button>
        }
        <button type="button" class="primary" (click)="save()">שמירה</button>
      </div>
    </section>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.35); z-index: 10; }
    .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; max-width: 480px; margin-inline: auto; z-index: 11;
      border-radius: 20px 20px 0 0; padding-block-end: calc(16px + env(safe-area-inset-bottom)); }
    .tabs { display: flex; gap: 4px; }
    .tabs button.on { background: var(--primary); color: var(--on-primary); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .link { border: none; background: none; color: var(--primary); padding: 0; justify-self: start; }
    .danger { color: var(--danger); }
    .icon { border: none; background: none; }
  `,
})
export class QuickAdd {
  protected readonly quickAdd = inject(QuickAddService);
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  protected readonly num = num;
  protected readonly tabs: { id: QuickAddTab; label: string }[] = [
    { id: 'meal', label: 'ארוחה' },
    { id: 'weight', label: 'משקל' },
    { id: 'activity', label: 'פעילות' },
  ];

  private readonly editing = this.quickAdd.editing();
  protected readonly meal = signal<MealDraft>(
    this.editing
      ? { name: this.editing.name, kcal: this.editing.kcal, protein: this.editing.protein, carbs: this.editing.carbs, fat: this.editing.fat }
      : { name: '', kcal: null, protein: null, carbs: null, fat: null },
  );
  protected readonly showMacros = signal(this.editing !== null && this.editing.protein !== null);
  protected readonly kg = signal<number | null>(null);
  protected readonly activity = signal<ActivityDraft>({ steps: null, type: '', minutes: null, kcal: null });
  protected readonly error = signal<string | null>(null);

  protected switchTab(tab: QuickAddTab): void {
    this.error.set(null);
    this.quickAdd.open(tab);
  }

  protected patchMeal<K extends keyof MealDraft>(key: K, value: MealDraft[K]): void {
    this.meal.update((m) => ({ ...m, [key]: value }));
  }

  protected patchActivity<K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]): void {
    this.activity.update((a) => ({ ...a, [key]: value }));
  }

  protected save(): void {
    const uid = this.state.uid();
    if (!uid) return;
    const now = this.state.now();
    const tab = this.quickAdd.tab();
    const editing = this.quickAdd.editing();
    let error: string | null;
    let payload: Payload | null = null;
    if (tab === 'meal') {
      error = mealError(this.meal());
      if (!error && editing) {
        this.finish(this.repo.saveEntry(uid, editedEntry(editing, this.meal())));
        return;
      }
      if (!error) payload = mealPayload(this.meal(), now, newLinkId());
    } else if (tab === 'weight') {
      error = weightError(this.kg());
      if (!error) payload = weightPayload(this.kg()!, now);
    } else {
      error = activityError(this.activity());
      if (!error) payload = activityPayload(this.activity(), now, newLinkId());
    }
    this.error.set(error);
    if (error || !payload) return;
    let writes;
    try {
      writes = planWrites(validatePayload(payload), { source: 'form', time: localTime(now) });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      return;
    }
    this.finish(this.repo.applyWrites(uid, writes, this.state.days()));
  }

  protected remove(): void {
    const uid = this.state.uid();
    const editing = this.quickAdd.editing();
    if (!uid || !editing || !confirm(`למחוק את "${editing.name}"?`)) return;
    this.finish(this.repo.deleteEntry(uid, editing.id), 'נמחק');
  }

  private finish(write: Promise<void>, message = 'נשמר'): void {
    write.catch(() => this.toast.show('השמירה נכשלה'));
    this.toast.show(message);
    this.quickAdd.close();
  }
}
