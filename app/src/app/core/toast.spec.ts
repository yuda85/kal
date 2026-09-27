import { TestBed } from '@angular/core/testing';
import { Toast } from './toast';

describe('Toast', () => {
  it('shows a message and hides it after 3 seconds', () => {
    vi.useFakeTimers();
    const toast = TestBed.inject(Toast);
    toast.show('נשמר');
    expect(toast.message()).toBe('נשמר');
    vi.advanceTimersByTime(3000);
    expect(toast.message()).toBeNull();
    vi.useRealTimers();
  });
});
