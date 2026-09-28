import { Week } from './week';

describe('Week styles', () => {
  it('never paints logged-deficit days in an on-track colour', () => {
    const css = (Week as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('');
    const rule = css.match(/\.cell\.deficit[^{]*\{[^}]*\}/)![0];
    expect(rule).not.toContain('--out');
    expect(rule).not.toContain('--success');
    expect(rule).not.toContain('--primary');
  });
});
