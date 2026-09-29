import { loadPhoto, savePhoto } from './checkin-photo';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('check-in photo', () => {
  it('keeps the photo on this device', () => {
    expect(loadPhoto()).toBeNull();
    expect(savePhoto('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(loadPhoto()).toBe('data:image/jpeg;base64,AAAA');
  });

  it('reports a full or blocked storage instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(savePhoto('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(loadPhoto()).toBeNull();
  });
});
