import { TIP_TOPICS, TIPS, TOPIC_LABEL, type Tip, type TipReason, type TipTopic } from '../../domain';
import type { SavedVideo } from '../../core/repository';
import { fmt } from '../../shared/format';

export type TipFilter = 'all' | 'starred' | 'videos' | TipTopic;

export interface TipSection {
  key: string;
  title: string;
  tips: Tip[];
  videos: SavedVideo[];
}

export const FILTERS: { key: TipFilter; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'starred', label: 'שמורים' },
  { key: 'videos', label: 'סרטונים' },
  ...TIP_TOPICS.map((topic) => ({ key: topic, label: TOPIC_LABEL[topic] })),
];

const newestFirst = (a: SavedVideo, b: SavedVideo) => b.addedAt.localeCompare(a.addedAt);

/** What the tips tab shows for a filter: starred tips pinned first, then a section per topic; empty sections are left out. */
export function tipSections(filter: TipFilter, starred: string[], videos: SavedVideo[]): TipSection[] {
  const isStarred = (t: Tip) => starred.includes(t.id);
  const pinned: TipSection = { key: 'starred', title: 'שמורים', tips: TIPS.filter(isStarred), videos: [] };
  let sections: TipSection[];
  if (filter === 'starred') sections = [pinned];
  else if (filter === 'videos') sections = [{ key: 'videos', title: 'סרטונים', tips: [], videos: [...videos].sort(newestFirst) }];
  else if (filter === 'all') {
    sections = [
      pinned,
      ...TIP_TOPICS.map((topic) => ({
        key: topic,
        title: TOPIC_LABEL[topic],
        tips: TIPS.filter((t) => t.topic === topic && !isStarred(t)),
        videos: videos.filter((v) => v.topic === topic).sort(newestFirst),
      })),
    ];
  } else {
    const tips = TIPS.filter((t) => t.topic === filter);
    sections = [
      {
        key: filter,
        title: TOPIC_LABEL[filter],
        tips: [...tips.filter(isStarred), ...tips.filter((t) => !isStarred(t))],
        videos: videos.filter((v) => v.topic === filter).sort(newestFirst),
      },
    ];
  }
  return sections.filter((s) => s.tips.length + s.videos.length > 0);
}

/** The line under "טיפ היום" that says why this tip was picked. */
export function reasonText(reason: TipReason): string {
  const of = (label: string, unit = 'g') => `אתמול: ${label} ${fmt(reason.value)}${unit} מתוך ${fmt(reason.target)}${unit}`;
  switch (reason.code) {
    case 'not_logged':
      return 'אתמול הרישום לא הושלם';
    case 'kcal_over':
      return `אתמול: ${fmt(reason.value)} מתוך ${fmt(reason.target)} קלוריות`;
    case 'fat_over':
      return of('שומן');
    case 'carbs_over':
      return of('פחמימות');
    case 'protein_low':
      return of('חלבון');
  }
}
