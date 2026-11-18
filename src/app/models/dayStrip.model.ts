import type { Language } from '../i18n/translations';

import { startOfDay, toIsoDate } from './date.model';

export type DotStatus = 'done' | 'today' | 'none';

export interface DayStrip {
  label: string; // 'L' | 'M' | 'M' | 'J' | 'V' | 'S' | 'D' (Monday-first initials)
  date: number; // day of month (1–31)
  dot: DotStatus;
  isoDate: string; // 'YYYY-MM-DD' — useful as *ngFor trackBy / keys
}

/** Single-letter day labels, Monday first (index = (Date.getDay() + 6) % 7). */
const STRIP_LABELS: Record<Language, string[]> = {
  fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

export function buildWeekStrip(
  reference: Date = new Date(),
  completedDates: Set<string> = new Set(), // ISO dates that are "done"
  lang: Language = 'fr',
): DayStrip[] {
  // Normalize to local midnight
  const today = startOfDay(reference);
  const todayIso = toIsoDate(today);

  // Monday-start offset
  const offset = (today.getDay() + 6) % 7; // Mon=0, Sun=6

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - offset);

  const strip: DayStrip[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);

    const iso = toIsoDate(d);
    const isToday = iso === todayIso;

    let dot: DotStatus = 'none';
    if (isToday) dot = 'today';
    else if (completedDates.has(iso)) dot = 'done';

    strip.push({
      label: STRIP_LABELS[lang][(d.getDay() + 6) % 7],
      date: d.getDate(),
      dot,
      isoDate: iso,
    });
  }
  return strip;
}
