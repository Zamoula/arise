import type { Language } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type { Habit } from '../services/habit.service';

import {
  addDays,
  compareDates,
  daysBetween,
  endOfMonth,
  minDate,
  parseIsoDate,
  startOfDay,
  startOfMonth,
  toIsoDate,
} from './date.model';
import { isExpectedOn } from './stats.model';

export type CalendarDayState = 'outside' | 'completed' | 'pause' | 'today' | 'future' | 'missed';

export interface CalendarDay {
  label: string;
  state: CalendarDayState;
}

export interface HabitKpi {
  label: string;
  icon: string;
  iconClass: string;
  value: string;
  unit?: string;
  sub: string;
  trend?: string;
}

export interface HistoryEntry {
  title: string;
  time: string;
  note: string;
  today?: boolean;
}

/** Everything the calendar card displays for one month. */
export interface DetailCalendar {
  /** Heading, e.g. "Novembre 2026". */
  label: string;
  /** Completions summary, e.g. "5 séances accomplies". */
  count: string;
  days: CalendarDay[];
  canGoPrev: boolean;
  canGoNext: boolean;
}

/** Full month names, used for the calendar heading. */
const MONTH_NAMES: Record<Language, string[]> = {
  fr: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/** Abbreviated month names, used inside the history titles. */
const MONTH_NAMES_SHORT: Record<Language, string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Weekday names, Monday first, used inside the history titles. */
const WEEKDAY_NAMES: Record<Language, string[]> = {
  fr: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

/** How many completions the "Historique récent" card keeps. */
const HISTORY_LIMIT = 5;

/**
 * Builds the four key figures of the habit detail page from a single habit's
 * completion history. Pure function: same habit + same day always produces
 * the same values, which keeps it easy to test.
 */
export function buildHabitKpis(habit: Habit, reference: Date = new Date(), lang: Language = 'fr'): HabitKpi[] {
  const streak = currentStreakFor(habit, reference);
  const best = bestStreakFor(habit);
  const month = monthStatsFor(habit, reference);
  const rate = month.expected === 0 ? 0 : Math.round((month.completed / month.expected) * 100);
  const total = new Set(habit.completedDates ?? []).size;

  return [
    {
      label: t(lang, 'detail.kpiStreak'),
      icon: 'local_fire_department',
      iconClass: 'kpi-card__badge--amber',
      value: String(streak),
      unit: t(lang, 'time.days'),
      sub: streak > 0 ? t(lang, 'detail.kpiStreakOn') : t(lang, 'detail.kpiStreakOff'),
      trend: streak > 0 ? 'trending_up' : undefined,
    },
    {
      label: t(lang, 'detail.kpiBest'),
      icon: 'military_tech',
      iconClass: 'kpi-card__badge--mint',
      value: String(best),
      unit: t(lang, 'time.days'),
      sub: best > 0 ? t(lang, 'detail.kpiBestOn') : t(lang, 'detail.kpiBestOff'),
    },
    {
      label: t(lang, 'detail.kpiRate'),
      icon: 'pie_chart',
      iconClass: 'kpi-card__badge--blue',
      value: `${rate}%`,
      sub:
        month.expected === 0
          ? t(lang, 'detail.kpiRateEmpty')
          : t(lang, 'detail.kpiRateSub', { completed: month.completed, expected: month.expected }),
    },
    {
      label: t(lang, 'detail.kpiTotal'),
      icon: 'self_improvement',
      iconClass: 'kpi-card__badge--neutral',
      value: String(total),
      sub: t(lang, 'detail.kpiTotalSub'),
    },
  ];
}

/**
 * Builds the calendar card for one month: leading cells from the previous
 * month (Monday-first), one cell per day of the month and the navigation
 * bounds. Days the habit was not scheduled on are shown as "pause douce".
 */
export function buildDetailCalendar(
  habit: Habit,
  month: Date,
  reference: Date = new Date(),
  lang: Language = 'fr',
): DetailCalendar {
  const today = startOfDay(reference);
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const completed = new Set(habit.completedDates ?? []);

  const days: CalendarDay[] = [];
  const leading = (first.getDay() + 6) % 7; // Monday = 0
  for (let offset = leading; offset > 0; offset--) {
    days.push({ label: String(addDays(first, -offset).getDate()), state: 'outside' });
  }

  let completedCount = 0;
  for (const day of daysBetween(first, last)) {
    const iso = toIsoDate(day);
    if (completed.has(iso)) {
      completedCount += 1;
    }
    days.push({ label: String(day.getDate()), state: calendarStateFor(habit, day, today, completed) });
  }

  const createdMonth = habit.createdAt ? startOfMonth(parseIsoDate(habit.createdAt) ?? first) : undefined;

  return {
    label: `${MONTH_NAMES[lang][first.getMonth()]} ${first.getFullYear()}`,
    count: `${completedCount} ${t(lang, completedCount === 1 ? 'unit.session' : 'unit.sessions')} ${t(
      lang,
      'detail.calendarCompleted',
    )}`,
    days,
    canGoPrev: createdMonth === undefined || compareDates(createdMonth, first) < 0,
    canGoNext: compareDates(first, startOfMonth(today)) < 0,
  };
}

function calendarStateFor(habit: Habit, day: Date, today: Date, completed: Set<string>): CalendarDayState {
  if (compareDates(day, today) === 0) {
    return 'today';
  }
  if (completed.has(toIsoDate(day))) {
    return 'completed';
  }
  if (compareDates(day, today) > 0) {
    return 'future';
  }
  // Past, not completed: a rest day ("pause douce") or a plain missed day.
  return isExpectedOn(habit, day) ? 'missed' : 'pause';
}

/**
 * Builds the recent-history list from the habit's completion dates, newest
 * first. Completion times are not tracked, so the scheduled reminder time is
 * shown instead.
 */
export function buildDetailHistory(habit: Habit, reference: Date = new Date(), lang: Language = 'fr'): HistoryEntry[] {
  const today = startOfDay(reference);
  const yesterday = addDays(today, -1);
  const time = habit.time ?? '—';
  const note = habit.doneNote?.trim() || t(lang, 'detail.noteValidated');

  return (habit.completedDates ?? [])
    .map((iso) => parseIsoDate(iso))
    .filter((day): day is Date => day !== undefined)
    .sort((a, b) => compareDates(b, a))
    .slice(0, HISTORY_LIMIT)
    .map((day) => ({
      title: historyTitle(day, today, yesterday, lang),
      time,
      note,
      today: compareDates(day, today) === 0,
    }));
}

function historyTitle(day: Date, today: Date, yesterday: Date, lang: Language): string {
  const short = `${day.getDate()} ${MONTH_NAMES_SHORT[lang][day.getMonth()]}`;
  if (compareDates(day, today) === 0) {
    return t(lang, 'detail.historyToday', { date: short });
  }
  if (compareDates(day, yesterday) === 0) {
    return t(lang, 'detail.historyYesterday', { date: short });
  }
  return `${WEEKDAY_NAMES[lang][(day.getDay() + 6) % 7]} ${short}`;
}

/** Longest run of consecutive completions; rest days in between don't break it. */
export function bestStreakFor(habit: Habit): number {
  const dates = (habit.completedDates ?? [])
    .map((iso) => parseIsoDate(iso))
    .filter((day): day is Date => day !== undefined)
    .sort((a, b) => compareDates(a, b));

  let best = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const day of dates) {
    run = previous && areChained(habit, previous, day) ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Two completions are chained when only rest days separate them. */
function areChained(habit: Habit, previous: Date, day: Date): boolean {
  for (const between of daysBetween(addDays(previous, 1), addDays(day, -1))) {
    if (isExpectedOn(habit, between)) {
      return false;
    }
  }
  return true;
}

/** Current streak of completions; rest days are skipped instead of breaking it. */
export function currentStreakFor(habit: Habit, reference: Date = new Date()): number {
  const completed = new Set(habit.completedDates ?? []);
  const created = habit.createdAt ? parseIsoDate(habit.createdAt) : undefined;

  let cursor = startOfDay(reference);
  // A streak stays alive during the day until it is actually broken.
  if (!completed.has(toIsoDate(cursor))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (created === undefined || compareDates(cursor, created) >= 0) {
    if (completed.has(toIsoDate(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!isExpectedOn(habit, cursor)) {
      cursor = addDays(cursor, -1); // Rest day: keep looking back.
      continue;
    }
    break;
  }
  return streak;
}

/** Completed and scheduled counts inside the month of `reference`. */
export function monthStatsFor(habit: Habit, reference: Date = new Date()): { completed: number; expected: number } {
  const first = startOfMonth(reference);
  const last = minDate(endOfMonth(first), startOfDay(reference));

  let completed = 0;
  let expected = 0;
  for (const day of daysBetween(first, last)) {
    if (!isExpectedOn(habit, day)) {
      continue;
    }
    expected += 1;
    if ((habit.completedDates ?? []).includes(toIsoDate(day))) {
      completed += 1;
    }
  }
  return { completed, expected };
}

/** Moves a month by `months` steps, always landing on its first day. */
export function shiftMonth(month: Date, months: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + months, 1);
}

/** Translates a key for the given language, interpolating `{name}` params. */
function t(lang: Language, key: string, params?: Record<string, string | number>): string {
  let text = TRANSLATIONS[lang][key] ?? TRANSLATIONS.fr[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
