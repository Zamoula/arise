import type { Language } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type { Habit, HabitSection, Moment } from '../services/habit.service';

import {
  addDays,
  compareDates,
  daysBetween,
  endOfMonth,
  isDateInRange,
  maxDate,
  minDate,
  parseIsoDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toIsoDate,
} from './date.model';

export type StatsPeriod = 'week' | 'month' | 'year';

export type RhythmFillClass = 'default' | 'today' | 'pause' | 'soft-1' | 'soft-2';

export interface RhythmDay {
  label: string;
  percent: number;
  fillClass: RhythmFillClass;
  hint: string;
  today: boolean;
  pause: boolean;
  future: boolean;
  completed: number;
  expected: number;
  startIso: string;
  endIso: string;
}

export interface Snapshot {
  icon: string;
  iconClass: string;
  title: string;
  detail: string;
  badge: string;
  badgeClass: string;
}

export interface CategoryBalance {
  name: string;
  dotClass: string;
  percent: number;
  fillClass: string;
  percentClass: string;
  detail: string;
  count: string;
}

export interface Badge {
  icon: string;
  circleClass: string;
  title: string;
  detail: string;
  unlocked: boolean;
}

export interface StatsSummary {
  periodWord: string;
  rhythmTitle: string;
  snapshotTitle: string;
  goalLabel: string;
  bannerHeadline: string;
  bannerSub: string;
  completionRate: number;
  completed: number;
  expected: number;
  rhythmDays: RhythmDay[];
  feedback: string;
  snapshots: Snapshot[];
  categories: CategoryBalance[];
  activeCategoryCount: number;
  badges: Badge[];
  unlockedBadgeCount: number;
}

/** Overall figures shown in the profile hero (all-time, not per period). */
export interface ProfileTotals {
  /** Share of scheduled habits completed since day one, rounded 0–100. */
  completionRate: number;
  completed: number;
  expected: number;
  /** Elapsed days where nothing was scheduled — rest taken guilt-free. */
  kindPauses: number;
  /**
   * Consecutive days with at least one completion, ending today (a day
   * without validation yet keeps the streak alive until tomorrow).
   */
  currentStreak: number;
}

interface PeriodCopy {
  word: string;
  rhythmTitle: string;
  snapshotTitle: string;
  bestLabel: string;
}

const PERIOD_KEYS: Record<
  StatsPeriod,
  { word: string; rhythmTitle: string; snapshotTitle: string; bestLabel: string }
> = {
  week: {
    word: 'statsModel.period.week.word',
    rhythmTitle: 'statsModel.period.week.rhythmTitle',
    snapshotTitle: 'statsModel.period.week.snapshotTitle',
    bestLabel: 'statsModel.period.week.bestLabel',
  },
  month: {
    word: 'statsModel.period.month.word',
    rhythmTitle: 'statsModel.period.month.rhythmTitle',
    snapshotTitle: 'statsModel.period.month.snapshotTitle',
    bestLabel: 'statsModel.period.month.bestLabel',
  },
  year: {
    word: 'statsModel.period.year.word',
    rhythmTitle: 'statsModel.period.year.rhythmTitle',
    snapshotTitle: 'statsModel.period.year.snapshotTitle',
    bestLabel: 'statsModel.period.year.bestLabel',
  },
};

function periodCopy(period: StatsPeriod, lang: Language): PeriodCopy {
  const keys = PERIOD_KEYS[period];
  return {
    word: t(lang, keys.word),
    rhythmTitle: t(lang, keys.rhythmTitle),
    snapshotTitle: t(lang, keys.snapshotTitle),
    bestLabel: t(lang, keys.bestLabel),
  };
}

/** Short weekday labels, Monday first. */
const WEEK_LABELS: Record<Language, string[]> = {
  fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

/** Short month labels, January first. */
const MONTH_LABELS: Record<Language, string[]> = {
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

type CategoryId = 'health' | 'mind' | 'growth';

interface CategoryDefinition {
  id: CategoryId;
  nameKey: string;
  icons: string[];
  dotClass: string;
  fillClass: string;
  percentClass: string;
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'health',
    nameKey: 'category.health',
    icons: ['water_drop', 'fitness_center', 'park', 'directions_bike'],
    dotClass: 'category__dot--health',
    fillClass: 'category__fill--health',
    percentClass: 'category__percent--health',
  },
  {
    id: 'mind',
    nameKey: 'category.mind',
    icons: ['self_improvement', 'bedtime'],
    dotClass: 'category__dot--mind',
    fillClass: 'category__fill--mind',
    percentClass: 'category__percent--mind',
  },
  {
    id: 'growth',
    nameKey: 'category.growth',
    icons: ['menu_book', 'edit_note'],
    dotClass: 'category__dot--growth',
    fillClass: 'category__fill--growth',
    percentClass: 'category__percent--growth',
  },
];

interface HabitEntry {
  habit: Habit;
  moment: Moment;
  completedDates: Set<string>;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface RangeStats {
  expected: number;
  completed: number;
}

interface Bucket extends DateRange {
  label: string;
}

/**
 * Builds every figure shown on the statistics page from the stored habits
 * and their completion history. Pure function: same data + same day always
 * produces the same summary, which keeps it easy to test.
 */
export function buildStats(
  sections: HabitSection[],
  period: StatsPeriod,
  reference: Date = new Date(),
  lang: Language = 'fr',
): StatsSummary {
  const today = startOfDay(reference);
  const copy = periodCopy(period, lang);
  const entries: HabitEntry[] = sections.flatMap((section) =>
    section.habits.map((habit) => ({
      habit,
      moment: section.id,
      completedDates: new Set(habit.completedDates ?? []),
    })),
  );

  const range = periodRange(period, today);
  const elapsedEnd = minDate(range.end, today);
  const totals = countRange(entries, range.start, elapsedEnd);
  const completionRate = rateOf(totals);
  const rhythmDays = buildBuckets(period, range, today, lang).map((bucket) =>
    toRhythmDay(bucket, entries, today, lang),
  );

  const categories = buildCategories(entries, range, elapsedEnd, lang);
  const badges = buildBadges(entries, range, elapsedEnd, today, lang);

  return {
    periodWord: copy.word,
    rhythmTitle: copy.rhythmTitle,
    snapshotTitle: copy.snapshotTitle,
    goalLabel:
      totals.expected > 0 && totals.completed >= totals.expected
        ? t(lang, 'statsModel.goalReached')
        : t(lang, 'statsModel.inProgress'),
    bannerHeadline: buildBannerHeadline(entries.length, totals, completionRate, copy.word, lang),
    bannerSub: totals.expected === 0 ? t(lang, 'statsModel.bannerSubEmpty') : t(lang, 'statsModel.bannerSub'),
    completionRate: Math.round(completionRate),
    completed: totals.completed,
    expected: totals.expected,
    rhythmDays,
    feedback: buildFeedback(rhythmDays, copy.bestLabel, lang),
    snapshots: buildSnapshots(entries, range, elapsedEnd, totals, completionRate, lang),
    categories,
    activeCategoryCount: categories.length,
    badges,
    unlockedBadgeCount: badges.filter((badge) => badge.unlocked).length,
  };
}

/**
 * Builds the profile hero figures from the stored habits. The completion rate
 * covers every scheduled occurrence since the first habit existed (today
 * included, like the statistics page); a "kind pause" is an elapsed day where
 * nothing was scheduled — the user rested instead of failing. Pure function:
 * same data + same day always produces the same totals, which keeps it easy
 * to test.
 */
export function buildAllTimeTotals(sections: HabitSection[], reference: Date = new Date()): ProfileTotals {
  const today = startOfDay(reference);
  const entries: HabitEntry[] = sections.flatMap((section) =>
    section.habits.map((habit) => ({
      habit,
      moment: section.id,
      completedDates: new Set(habit.completedDates ?? []),
    })),
  );

  const start = firstTrackedDate(entries);
  if (!start) {
    return { completionRate: 0, completed: 0, expected: 0, kindPauses: 0, currentStreak: 0 };
  }

  const totals = countRange(entries, start, today);

  let kindPauses = 0;
  for (const day of daysBetween(start, today)) {
    const scheduled = entries.some((entry) => isExpectedOn(entry.habit, day));
    if (!scheduled) {
      kindPauses += 1;
    }
  }

  return {
    completionRate: Math.round(rateOf(totals)),
    completed: totals.completed,
    expected: totals.expected,
    kindPauses,
    currentStreak: currentStreak(entries, today),
  };
}

/** Earliest day the habit history can talk about (creation or completion). */
function firstTrackedDate(entries: HabitEntry[]): Date | undefined {
  const dates: Date[] = [];
  for (const entry of entries) {
    if (entry.habit.createdAt) {
      const created = parseIsoDate(entry.habit.createdAt);
      if (created) {
        dates.push(created);
      }
    }
    for (const iso of entry.habit.completedDates ?? []) {
      const completed = parseIsoDate(iso);
      if (completed) {
        dates.push(completed);
      }
    }
  }
  return dates.length > 0 ? dates.reduce((min, date) => (compareDates(date, min) < 0 ? date : min)) : undefined;
}

function periodRange(period: StatsPeriod, today: Date): DateRange {
  switch (period) {
    case 'week': {
      const start = startOfWeek(today);
      return { start, end: addDays(start, 6) };
    }
    case 'month':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'year':
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: new Date(today.getFullYear(), 11, 31),
      };
  }
}

function buildBuckets(period: StatsPeriod, range: DateRange, today: Date, lang: Language): Bucket[] {
  if (period === 'week') {
    return daysBetween(range.start, range.end).map((day, index) => ({
      start: day,
      end: day,
      label: WEEK_LABELS[lang][index],
    }));
  }

  if (period === 'month') {
    const buckets: Bucket[] = [];
    let weekStart = startOfWeek(range.start);
    let index = 1;
    while (compareDates(weekStart, range.end) <= 0) {
      const weekEnd = addDays(weekStart, 6);
      buckets.push({
        start: maxDate(weekStart, range.start),
        end: minDate(weekEnd, range.end),
        label: `S${index}`,
      });
      weekStart = addDays(weekEnd, 1);
      index += 1;
    }
    return buckets;
  }

  return MONTH_LABELS[lang].map((label, index) => ({
    start: new Date(today.getFullYear(), index, 1),
    end: endOfMonth(new Date(today.getFullYear(), index, 1)),
    label,
  }));
}

function toRhythmDay(bucket: Bucket, entries: HabitEntry[], today: Date, lang: Language): RhythmDay {
  const future = compareDates(bucket.start, today) > 0;
  const elapsedEnd = minDate(bucket.end, today);
  const stats =
    compareDates(elapsedEnd, bucket.start) < 0
      ? { expected: 0, completed: 0 }
      : countRange(entries, bucket.start, elapsedEnd);
  const percent = Math.round(rateOf(stats));
  const isToday = isDateInRange(today, bucket.start, bucket.end);
  const pause = !future && stats.expected === 0;

  let fillClass: RhythmFillClass = 'soft-2';
  if (isToday) {
    fillClass = 'today';
  } else if (pause) {
    fillClass = 'pause';
  } else if (percent >= 95) {
    fillClass = 'default';
  } else if (percent >= 80) {
    fillClass = 'soft-1';
  }

  return {
    label: bucket.label,
    percent,
    fillClass,
    hint: future ? t(lang, 'statsModel.rhythmUpcoming') : pause ? t(lang, 'statsModel.rhythmRest') : `${percent}%`,
    today: isToday,
    pause,
    future,
    completed: stats.completed,
    expected: stats.expected,
    startIso: toIsoDate(bucket.start),
    endIso: toIsoDate(bucket.end),
  };
}

/** Counts scheduled occurrences and completed ones inside a date range. */
function countRange(entries: HabitEntry[], start: Date, end: Date): RangeStats {
  if (compareDates(start, end) > 0) {
    return { expected: 0, completed: 0 };
  }

  let expected = 0;
  let completed = 0;
  for (const day of daysBetween(start, end)) {
    const iso = toIsoDate(day);
    for (const entry of entries) {
      if (!isExpectedOn(entry.habit, day)) {
        continue;
      }
      expected += 1;
      if (entry.completedDates.has(iso)) {
        completed += 1;
      }
    }
  }
  return { expected, completed };
}

/**
 * A habit is expected on a day when it existed and its schedule includes it.
 * Shared by the statistics page and the habit detail page.
 */
export function isExpectedOn(habit: Habit, day: Date): boolean {
  const created = habit.createdAt ? parseIsoDate(habit.createdAt) : undefined;
  if (created && compareDates(day, created) < 0) {
    return false;
  }

  if ((habit.frequency === 'custom' || habit.frequency === 'weekly') && habit.days?.length === 7) {
    const dayIndex = (day.getDay() + 6) % 7; // Monday = 0
    return habit.days[dayIndex];
  }

  return true;
}

function rateOf(stats: RangeStats): number {
  return stats.expected === 0 ? 0 : (stats.completed / stats.expected) * 100;
}

function formatPercent(value: number, lang: Language = 'fr'): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  const decimals = rounded.toFixed(1);
  return `${lang === 'fr' ? decimals.replace('.', ',') : decimals}%`;
}

function buildBannerHeadline(
  habitCount: number,
  totals: RangeStats,
  rate: number,
  periodWord: string,
  lang: Language,
): string {
  if (habitCount === 0) {
    return t(lang, 'statsModel.bannerNoHabits');
  }
  if (totals.expected === 0) {
    return t(lang, 'statsModel.bannerUpcoming', { period: periodWord });
  }
  if (rate >= 80) {
    return t(lang, 'statsModel.bannerGreat', { rate: formatPercent(rate, lang), period: periodWord });
  }
  if (rate > 0) {
    return t(lang, 'statsModel.bannerKeepGoing', { rate: formatPercent(rate, lang), period: periodWord });
  }
  return t(lang, 'statsModel.bannerFreshStart', { period: periodWord });
}

function buildFeedback(rhythmDays: RhythmDay[], bestLabel: string, lang: Language): string {
  const best = rhythmDays.filter((day) => !day.future && day.expected > 0).sort((a, b) => b.percent - a.percent)[0];

  return best
    ? t(lang, 'statsModel.feedbackBest', { best: bestLabel, day: best.label, percent: best.percent })
    : t(lang, 'statsModel.feedbackEmpty');
}

function buildSnapshots(
  entries: HabitEntry[],
  range: DateRange,
  elapsedEnd: Date,
  totals: RangeStats,
  rate: number,
  lang: Language,
): Snapshot[] {
  const consistent = entries
    .map((entry) => ({ entry, stats: countRange([entry], range.start, elapsedEnd) }))
    .filter((item) => item.stats.completed > 0 && item.stats.expected > 0)
    .sort(
      (a, b) =>
        rateOf(b.stats) - rateOf(a.stats) ||
        b.stats.completed - a.stats.completed ||
        a.entry.habit.title.localeCompare(b.entry.habit.title),
    )[0];

  const momentCounts: Record<Moment, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (const day of daysBetween(range.start, elapsedEnd)) {
    const iso = toIsoDate(day);
    for (const entry of entries) {
      if (isExpectedOn(entry.habit, day) && entry.completedDates.has(iso)) {
        momentCounts[entry.moment] += 1;
      }
    }
  }
  const bestMoment = (Object.keys(momentCounts) as Moment[]).reduce((best, moment) =>
    momentCounts[moment] > momentCounts[best] ? moment : best,
  );
  const momentTotal = momentCounts[bestMoment];

  return [
    {
      icon: 'check_circle',
      iconClass: 'snapshot__icon--mint',
      title: t(lang, 'statsModel.snapshotVolume'),
      detail:
        totals.expected === 0
          ? t(lang, 'statsModel.snapshotVolumeEmpty')
          : t(lang, 'statsModel.snapshotVolumeDetail', {
              completed: totals.completed,
              expected: totals.expected,
            }),
      badge: totals.expected === 0 ? '—' : formatPercent(rate, lang),
      badgeClass: 'snapshot__badge--mint',
    },
    {
      icon: consistent ? consistent.entry.habit.icon : 'trending_up',
      iconClass: 'snapshot__icon--blue',
      title: t(lang, 'statsModel.snapshotConsistent'),
      detail: consistent ? consistent.entry.habit.title : t(lang, 'statsModel.snapshotConsistentEmpty'),
      badge: consistent ? formatPercent(rateOf(consistent.stats), lang) : '—',
      badgeClass: 'snapshot__badge--blue',
    },
    {
      icon: 'wb_twilight',
      iconClass: 'snapshot__icon--amber',
      title: t(lang, 'statsModel.snapshotMoment'),
      detail: momentTotal > 0 ? t(lang, `momentDetail.${bestMoment}`) : t(lang, 'statsModel.snapshotMomentEmpty'),
      badge: momentTotal > 0 ? t(lang, `momentBadge.${bestMoment}`) : '—',
      badgeClass: 'snapshot__badge--neutral',
    },
  ];
}

function buildCategories(entries: HabitEntry[], range: DateRange, elapsedEnd: Date, lang: Language): CategoryBalance[] {
  const categories: CategoryBalance[] = [];

  for (const definition of CATEGORY_DEFINITIONS) {
    const categoryEntries = entries.filter((entry) => categoryFor(entry.habit).id === definition.id);
    if (categoryEntries.length === 0) {
      continue;
    }

    const stats = countRange(categoryEntries, range.start, elapsedEnd);
    const titles = [...new Set(categoryEntries.map((entry) => entry.habit.title))];
    const detail = `${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '…' : ''}`;

    categories.push({
      name: t(lang, definition.nameKey),
      dotClass: definition.dotClass,
      percent: Math.round(rateOf(stats)),
      fillClass: definition.fillClass,
      percentClass: definition.percentClass,
      detail,
      count: t(lang, 'statsModel.ritualsCount', { completed: stats.completed, expected: stats.expected }),
    });
  }

  return categories;
}

function categoryFor(habit: Habit): CategoryDefinition {
  return (
    CATEGORY_DEFINITIONS.find((definition) => definition.icons.includes(habit.icon)) ??
    CATEGORY_DEFINITIONS[CATEGORY_DEFINITIONS.length - 1]
  );
}

function buildBadges(entries: HabitEntry[], range: DateRange, elapsedEnd: Date, today: Date, lang: Language): Badge[] {
  const streak = currentStreak(entries, today);
  const earlyDays = earlyMorningDays(entries);
  const hydrationEntries = entries.filter((entry) => entry.habit.icon === 'water_drop');
  const hydration = countRange(hydrationEntries, range.start, elapsedEnd);
  const hydrationRate = rateOf(hydration);
  const hydrationTarget = Math.max(hydration.expected, 3);
  const hydrationUnlocked = hydration.expected >= 3 && hydration.completed >= hydration.expected;

  return [
    {
      icon: 'spa',
      circleClass: 'badge-card__circle--mint',
      title: t(lang, 'badge.constancy'),
      detail:
        streak >= 7
          ? t(lang, 'badge.streakDetail', { count: streak })
          : t(lang, 'badge.streakDetailProgress', { count: streak }),
      unlocked: streak >= 7,
    },
    {
      icon: 'wb_sunny',
      circleClass: 'badge-card__circle--amber',
      title: t(lang, 'badge.earlyBird'),
      detail:
        earlyDays >= 5
          ? t(lang, 'badge.morningsDetail', { count: earlyDays })
          : t(lang, 'badge.morningsDetailProgress', { count: earlyDays }),
      unlocked: earlyDays >= 5,
    },
    {
      icon: 'water_drop',
      circleClass: 'badge-card__circle--blue',
      title: t(lang, 'badge.hydration'),
      detail:
        hydrationEntries.length === 0
          ? t(lang, 'badge.hydrationEmpty')
          : hydrationUnlocked
            ? t(lang, 'badge.hydrationRate', { rate: formatPercent(hydrationRate, lang) })
            : t(lang, 'badge.hydrationProgress', {
                completed: hydration.completed,
                target: hydrationTarget,
              }),
      unlocked: hydrationUnlocked,
    },
  ];
}

function currentStreak(entries: HabitEntry[], today: Date): number {
  const completedDates = allCompletedDates(entries);
  let cursor = today;
  // A streak stays alive during the day until it is actually broken.
  if (!completedDates.has(toIsoDate(cursor))) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (completedDates.has(toIsoDate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function earlyMorningDays(entries: HabitEntry[]): number {
  const dates = new Set<string>();
  for (const entry of entries) {
    if (entry.moment !== 'morning') {
      continue;
    }
    const hour = parseHour(entry.habit.time);
    if (hour !== undefined && hour >= 9) {
      continue;
    }
    entry.completedDates.forEach((date) => dates.add(date));
  }
  return dates.size;
}

function allCompletedDates(entries: HabitEntry[]): Set<string> {
  const dates = new Set<string>();
  for (const entry of entries) {
    entry.completedDates.forEach((date) => dates.add(date));
  }
  return dates;
}

function parseHour(time: string | undefined): number | undefined {
  if (!time) {
    return undefined;
  }
  const hour = Number.parseInt(time.slice(0, 2), 10);
  return Number.isNaN(hour) ? undefined : hour;
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
