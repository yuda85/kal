import { TIPS } from '../../domain';
import type { SavedVideo } from '../../core/repository';
import { reasonText, tipSections } from './tips.logic';

const video = (id: string, topic: SavedVideo['topic'], addedAt: string): SavedVideo => ({ id, url: 'https://youtu.be/x', title: id, take: 'take', topic, addedAt });
const videos = [video('old', 'hunger', '2026-09-01T10:00:00Z'), video('new', 'hunger', '2026-09-20T10:00:00Z'), video('prot', 'protein', '2026-09-10T10:00:00Z')];

describe('tipSections', () => {
  it('pins starred tips on top and leaves them out of their topic', () => {
    const s = tipSections('all', ['sauce-side'], []);
    expect(s[0].key).toBe('starred');
    expect(s[0].tips.map((t) => t.id)).toEqual(['sauce-side']);
    expect(s.find((x) => x.key === 'fat')!.tips.some((t) => t.id === 'sauce-side')).toBe(false);
  });

  it('shows every topic, with its videos newest first, and no starred section without stars', () => {
    const s = tipSections('all', [], videos);
    expect(s).toHaveLength(11);
    expect(s.reduce((n, x) => n + x.tips.length, 0)).toBe(TIPS.length);
    expect(s.find((x) => x.key === 'hunger')!.videos.map((v) => v.id)).toEqual(['new', 'old']);
  });

  it('filters to starred, videos or one topic', () => {
    expect(tipSections('starred', [], [])).toEqual([]);
    expect(tipSections('videos', [], videos)[0].videos.map((v) => v.id)).toEqual(['new', 'prot', 'old']);
    expect(tipSections('videos', [], [])).toEqual([]);
    const water = tipSections('water', ['thirst-hunger'], []);
    expect(water).toHaveLength(1);
    expect(water[0].tips[0].id).toBe('thirst-hunger');
  });
});

describe('reasonText', () => {
  it('says what happened yesterday', () => {
    expect(reasonText({ code: 'not_logged', topic: 'tracking' })).toBe('אתמול הרישום לא הושלם');
    expect(reasonText({ code: 'kcal_over', topic: 'hunger', value: 2750, target: 2341 })).toBe('אתמול: 2,750 מתוך 2,341 קלוריות');
    expect(reasonText({ code: 'fat_over', topic: 'fat', value: 98.4, target: 78 })).toBe('אתמול: שומן 98g מתוך 78g');
    expect(reasonText({ code: 'protein_low', topic: 'protein', value: 100, target: 166 })).toBe('אתמול: חלבון 100g מתוך 166g');
  });
});
