import { TestBed } from '@angular/core/testing';
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
});
