import { TestBed } from '@angular/core/testing';
import { LinkIntake } from './link-intake';

describe('LinkIntake', () => {
  it('captures a confirm payload and removes it from the address bar', () => {
    const intake = TestBed.inject(LinkIntake);
    const calls: string[] = [];
    intake.capture({ hash: '#p=abc_DEF-1', pathname: '/kal/', search: '' }, { replaceState: (_d, _t, url) => calls.push(String(url)) });
    expect(intake.pending()).toBe('abc_DEF-1');
    expect(calls).toEqual(['/kal/']);
  });

  it('ignores other hashes', () => {
    const intake = TestBed.inject(LinkIntake);
    const calls: string[] = [];
    intake.capture({ hash: '#section', pathname: '/kal/', search: '' }, { replaceState: (_d, _t, url) => calls.push(String(url)) });
    expect(intake.pending()).toBeNull();
    expect(calls).toEqual([]);
  });

  it('clears the pending payload', () => {
    const intake = TestBed.inject(LinkIntake);
    intake.pending.set('x');
    intake.clear();
    expect(intake.pending()).toBeNull();
  });
});
