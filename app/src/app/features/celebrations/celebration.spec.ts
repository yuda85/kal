import { TestBed } from '@angular/core/testing';
import { makeEntry } from '../../../../../domain/testing.ts';
import { NOW, seededRepository } from '../../../testing/fake-repository';
import { KalState } from '../../core/kal-state';
import { KalRepository } from '../../core/repository';
import { CelebrationDialog } from './celebration';

describe('Celebration dialog', () => {
  it('shows the new milestone and closes with יאללה', async () => {
    const repo = seededRepository();
    repo.celebrations = { seen: [] };
    TestBed.configureTestingModule({ imports: [CelebrationDialog], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    const fixture = TestBed.createComponent(CelebrationDialog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')!.textContent).toContain('ירדת 4 ק״ג!');
    el.querySelector<HTMLButtonElement>('button.primary')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(repo.savedCelebrations.at(-1)!.seen).toContain('weight-g1-4');
  });

  it('closes on Escape from anywhere, not only while focus is inside the dialog', async () => {
    const repo = seededRepository();
    repo.celebrations = { seen: [] };
    TestBed.configureTestingModule({ imports: [CelebrationDialog], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    const fixture = TestBed.createComponent(CelebrationDialog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(repo.savedCelebrations.at(-1)!.seen).toContain('weight-g1-4');
  });

  it('shows several due achievements as a list', async () => {
    const repo = seededRepository();
    repo.celebrations = { seen: [] };
    for (let d = 19; d <= 26; d++) repo.entries.push(makeEntry({ date: `2026-09-${d}`, kcal: 1500 }));
    TestBed.configureTestingModule({ imports: [CelebrationDialog], providers: [{ provide: KalRepository, useValue: repo }] });
    const state = TestBed.inject(KalState);
    state.now.set(NOW);
    state.start('u1');
    const fixture = TestBed.createComponent(CelebrationDialog);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('כמה הישגים חדשים');
    const items = Array.from(dialog.querySelectorAll('.list li')).map((li) => li.textContent ?? '');
    expect(items.some((text) => text.includes('ירדת 4 ק״ג!'))).toBe(true);
    expect(items.some((text) => text.includes('7 ימים ברצף!'))).toBe(true);
  });
});
