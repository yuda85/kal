import { Component, computed, inject, signal } from '@angular/core';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { Toast } from '../../core/toast';
import { fmt } from '../../shared/format';
import { recipeRow } from './recipes.logic';

@Component({
  selector: 'app-recipes',
  template: `
    <h2>מתכונים</h2>
    <ul class="list">
      @for (r of rows(); track r.row.id) {
        <li class="card">
          <button type="button" class="head" (click)="toggle(r.row.id)" [attr.aria-expanded]="open() === r.row.id">
            <span><strong>{{ r.row.name }}</strong>@if (r.row.aliases) { <span class="muted small"> · {{ r.row.aliases }}</span> }</span>
            <span class="num">{{ r.row.perLabel }}</span>
          </button>
          <div class="muted small num">{{ r.row.macros }}</div>
          @if (open() === r.row.id) {
            <ul class="ingredients small">
              @for (i of r.recipe.ingredients; track $index) {
                <li class="row"><span>{{ i.name }}</span><span class="num">{{ fmt(i.grams) }} ג׳</span></li>
              }
            </ul>
            <button type="button" class="danger" (click)="remove(r.row.id, r.row.name)">מחיקה</button>
          }
        </li>
      } @empty {
        <li class="muted small">אין מתכונים עדיין. ספר ל-Claude מה בישלת והוא ייצור מתכון.</li>
      }
    </ul>
  `,
  styles: `
    .list { list-style: none; padding: 0; display: grid; gap: 8px; }
    .head { display: flex; justify-content: space-between; width: 100%; border: none; background: none; padding: 0; text-align: start; }
    .ingredients { list-style: none; padding: 0; margin: 8px 0; }
    .danger { color: var(--danger); }
  `,
})
export class Recipes {
  private readonly state = inject(KalState);
  private readonly repo = inject(KalRepository);
  private readonly toast = inject(Toast);
  protected readonly fmt = fmt;
  protected readonly open = signal<string | null>(null);
  protected readonly rows = computed(() => this.state.recipes().map((recipe) => ({ recipe, row: recipeRow(recipe) })));

  protected toggle(id: string): void {
    this.open.update((current) => (current === id ? null : id));
  }

  protected remove(id: string, name: string): void {
    const uid = this.state.uid();
    if (!uid || !confirm(`למחוק את המתכון "${name}"?`)) return;
    this.repo.deleteRecipe(uid, id).catch(() => this.toast.show('המחיקה נכשלה'));
    this.toast.show('נמחק');
  }
}
