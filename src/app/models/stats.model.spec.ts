import type { Habit, HabitSection } from '../services/habit.service';

import { buildAllTimeTotals, buildStats } from './stats.model';

const ALL_DAYS = [true, true, true, true, true, true, true];
const MONDAY_ONLY = [true, false, false, false, false, false, false];

function makeHabit(overrides: Partial<Habit> & Pick<Habit, 'id' | 'title'>): Habit {
  return {
    icon: 'self_improvement',
    iconClass: 'habit-card__icon--mint',
    state: 'todo',
    frequency: 'daily',
    days: ALL_DAYS,
    completedDates: [],
    createdAt: '2026-11-01',
    ...overrides,
  };
}

function makeSections(habits: Habit[]): HabitSection[] {
  return [
    { id: 'morning', label: 'Matin', icon: 'wb_twilight', habits },
    { id: 'afternoon', label: 'Après-midi', icon: 'light_mode', habits: [] },
    { id: 'evening', label: 'Soirée', icon: 'bedtime', habits: [] },
  ];
}

describe('buildStats', () => {
  const reference = new Date(2026, 10, 18); // Wednesday 18 November 2026.

  it('computes the weekly rhythm from completion history', () => {
    const stats = buildStats(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          completedDates: ['2026-11-16', '2026-11-17', '2026-11-18'],
        }),
      ]),
      'week',
      reference,
    );

    expect(stats.expected).toBe(3);
    expect(stats.completed).toBe(3);
    expect(stats.completionRate).toBe(100);
    expect(stats.goalLabel).toBe('Objectif atteint');
    expect(stats.rhythmDays).toHaveLength(7);
    expect(stats.rhythmDays[0].percent).toBe(100);
    expect(stats.rhythmDays[2].today).toBe(true);
    expect(stats.rhythmDays[3].future).toBe(true);
    expect(stats.rhythmDays[3].expected).toBe(0);
  });

  it('only expects a habit on the days selected in its schedule', () => {
    const stats = buildStats(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Course',
          frequency: 'custom',
          days: MONDAY_ONLY,
          completedDates: ['2026-11-16'],
        }),
      ]),
      'week',
      reference,
    );

    expect(stats.expected).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.completionRate).toBe(100);
    expect(stats.rhythmDays[1].expected).toBe(0);
    expect(stats.rhythmDays[1].pause).toBe(true);
  });

  it('derives category balance from habit icons', () => {
    const stats = buildStats(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Boire de l’eau',
          icon: 'water_drop',
          completedDates: ['2026-11-16'],
        }),
        makeHabit({
          id: 2,
          title: 'Méditation guidée',
          icon: 'self_improvement',
          completedDates: ['2026-11-16'],
        }),
        makeHabit({
          id: 3,
          title: 'Lire 10 pages',
          icon: 'menu_book',
          createdAt: '2026-11-17',
        }),
      ]),
      'week',
      reference,
    );

    expect(stats.categories.map((category) => category.name)).toEqual([
      'Santé & Corps',
      'Esprit & Sérénité',
      'Développement & Lecture',
    ]);
    expect(stats.activeCategoryCount).toBe(3);
    expect(stats.categories[2].count).toBe('0/2 rituels');
  });

  it('unlocks badges from real history', () => {
    const stats = buildStats(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation du matin',
          icon: 'self_improvement',
          time: '07:30',
          completedDates: [
            '2026-11-12',
            '2026-11-13',
            '2026-11-14',
            '2026-11-15',
            '2026-11-16',
            '2026-11-17',
            '2026-11-18',
          ],
        }),
        makeHabit({
          id: 2,
          title: 'Boire de l’eau',
          icon: 'water_drop',
          createdAt: '2026-11-16',
          completedDates: ['2026-11-16', '2026-11-17', '2026-11-18'],
        }),
      ]),
      'week',
      reference,
    );

    expect(stats.badges.map((badge) => badge.unlocked)).toEqual([true, true, true]);
    expect(stats.unlockedBadgeCount).toBe(3);
    expect(stats.snapshots[1].detail).toBe('Boire de l’eau');
  });

  it('groups the month into weeks and the year into months', () => {
    const sections = makeSections([
      makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-16', '2026-11-17', '2026-11-18'],
      }),
    ]);

    const month = buildStats(sections, 'month', reference);
    expect(month.rhythmDays.length).toBeGreaterThanOrEqual(5);
    expect(month.rhythmDays[0].label).toBe('S1');

    const year = buildStats(sections, 'year', reference);
    expect(year.rhythmDays).toHaveLength(12);
    expect(year.rhythmDays[10].label).toBe('Nov');
    expect(year.rhythmDays[10].today).toBe(true);
  });

  it('exposes an empty summary when no habit exists', () => {
    const stats = buildStats(makeSections([]), 'week', reference);

    expect(stats.expected).toBe(0);
    expect(stats.categories).toEqual([]);
    expect(stats.unlockedBadgeCount).toBe(0);
    expect(stats.bannerHeadline).toContain('première habitude');
  });
});

describe('buildAllTimeTotals', () => {
  const reference = new Date(2026, 10, 18); // Wednesday 18 November 2026.

  it('is all zeros when no habit exists', () => {
    const totals = buildAllTimeTotals(makeSections([]), reference);

    expect(totals).toEqual({ completionRate: 0, completed: 0, expected: 0, kindPauses: 0, currentStreak: 0 });
  });

  it('rates every scheduled occurrence since the habit was created', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-16',
          // Expected on the 16th, 17th and 18th: completed twice.
          completedDates: ['2026-11-16', '2026-11-18'],
        }),
      ]),
      reference,
    );

    expect(totals.expected).toBe(3);
    expect(totals.completed).toBe(2);
    expect(totals.completionRate).toBe(67);
    // The 16th and 18th are done, the 17th broke the streak… but today's
    // completion restarts it at 1.
    expect(totals.currentStreak).toBe(1);
  });

  it('streaks consecutive completion days ending today', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-14',
          completedDates: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'],
        }),
      ]),
      reference,
    );

    // Five days in a row up to (and including) today.
    expect(totals.currentStreak).toBe(5);
  });

  it('keeps a streak alive when today is not validated yet', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-16',
          completedDates: ['2026-11-16', '2026-11-17'],
        }),
      ]),
      reference,
    );

    // Today has no validation yet, but the streak only breaks tomorrow.
    expect(totals.currentStreak).toBe(2);
  });

  it('resets the streak after a missed day', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-14',
          completedDates: ['2026-11-14', '2026-11-15', '2026-11-17', '2026-11-18'],
        }),
      ]),
      reference,
    );

    // The 16th was missed: the streak restarted on the 17th.
    expect(totals.currentStreak).toBe(2);
  });

  it('counts elapsed days with nothing scheduled as kind pauses', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-16',
          completedDates: ['2026-11-16', '2026-11-18'],
        }),
      ]),
      reference,
    );

    // 16 → 18 November: each day has the habit scheduled, so no pause.
    expect(totals.kindPauses).toBe(0);
  });

  it('does not count days before the first habit existed', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-16',
          completedDates: ['2026-11-17'],
        }),
        makeHabit({
          id: 2,
          title: 'Lecture',
          createdAt: '2026-11-18',
          completedDates: [],
        }),
      ]),
      reference,
    );

    // History starts on the 16th: three elapsed days, the daily habit makes
    // every one of them scheduled, so no pause. One completion out of four
    // scheduled occurrences (three days × two habits, minus the lecture one).
    expect(totals.kindPauses).toBe(0);
    expect(totals.completionRate).toBe(25);
  });

  it('starts from the earliest habit and skips unscheduled days', () => {
    const totals = buildAllTimeTotals(
      makeSections([
        makeHabit({
          id: 1,
          title: 'Méditation',
          createdAt: '2026-11-16',
          frequency: 'custom',
          days: [true, false, false, false, false, false, false], // Mondays only.
          completedDates: ['2026-11-16'],
        }),
        makeHabit({
          id: 2,
          title: 'Lecture',
          createdAt: '2026-11-18',
          frequency: 'custom',
          days: [true, false, false, false, false, false, false], // Mondays only.
          completedDates: [],
        }),
      ]),
      reference,
    );

    // 18 November 2026 is a Wednesday: after the Monday 16th, the Tuesday
    // and Wednesday are elapsed days with nothing scheduled → two pauses.
    expect(totals.kindPauses).toBe(2);
    expect(totals.completionRate).toBe(100); // 1 completion of 1 scheduled day.
  });
});
