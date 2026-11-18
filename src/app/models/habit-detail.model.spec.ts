import type { Habit } from '../services/habit.service';

import {
  bestStreakFor,
  buildDetailCalendar,
  buildDetailHistory,
  buildHabitKpis,
  currentStreakFor,
  monthStatsFor,
} from './habit-detail.model';

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

describe('habit-detail model', () => {
  const reference = new Date(2026, 10, 18); // Wednesday 18 November 2026.

  describe('currentStreakFor', () => {
    it('counts consecutive completed days ending today', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-16', '2026-11-17', '2026-11-18'],
      });

      expect(currentStreakFor(habit, reference)).toBe(3);
    });

    it('survives an incomplete today by falling back to yesterday', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-15', '2026-11-16', '2026-11-17'],
      });

      expect(currentStreakFor(habit, reference)).toBe(3);
    });

    it('is zero when the streak is already broken', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-10', '2026-11-11'],
      });

      expect(currentStreakFor(habit, reference)).toBe(0);
    });

    it('skips rest days instead of breaking the streak', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Course',
        frequency: 'custom',
        days: MONDAY_ONLY,
        completedDates: ['2026-11-09', '2026-11-16'],
      });

      expect(currentStreakFor(habit, reference)).toBe(2);
    });
  });

  describe('bestStreakFor', () => {
    it('returns the longest run of consecutive completions', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-16', '2026-11-17'],
      });

      expect(bestStreakFor(habit)).toBe(3);
    });

    it('chains completions across rest days', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Course',
        frequency: 'custom',
        days: MONDAY_ONLY,
        completedDates: ['2026-11-02', '2026-11-09', '2026-11-16'],
      });

      expect(bestStreakFor(habit)).toBe(3);
    });

    it('returns zero without completions', () => {
      expect(bestStreakFor(makeHabit({ id: 1, title: 'Méditation' }))).toBe(0);
    });
  });

  describe('monthStatsFor', () => {
    it('counts only the scheduled days up to the reference date', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-02', '2026-11-17'],
      });

      expect(monthStatsFor(habit, reference)).toEqual({ completed: 2, expected: 18 });
    });

    it('counts nothing before the habit was created', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        createdAt: '2026-11-15',
      });

      expect(monthStatsFor(habit, reference).expected).toBe(4);
    });
  });

  describe('buildHabitKpis', () => {
    it('derives the four cards from the completion history', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        time: '08:00',
        completedDates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-17'],
      });

      const kpis = buildHabitKpis(habit, reference);

      expect(kpis.map((kpi) => kpi.label)).toEqual([
        'Série actuelle',
        'Meilleur résultat',
        'Taux de réussite',
        'Total accompli',
      ]);
      expect(kpis[0].value).toBe('1');
      expect(kpis[1].value).toBe('3');
      expect(kpis[2].value).toBe('22%');
      expect(kpis[3].value).toBe('4');
    });
  });

  describe('buildDetailCalendar', () => {
    it('builds the current month with today, completions and navigation bounds', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-02', '2026-11-16'],
      });

      const calendar = buildDetailCalendar(habit, new Date(2026, 10, 1), reference);

      expect(calendar.label).toBe('Novembre 2026');
      expect(calendar.count).toBe('2 séances accomplies');
      // The habit was created this month: no navigating before it.
      expect(calendar.canGoPrev).toBe(false);
      expect(calendar.canGoNext).toBe(false);

      // 1 November 2026 is a Sunday: 6 leading outside cells.
      expect(calendar.days.slice(0, 6).every((day) => day.state === 'outside')).toBe(true);
      expect(calendar.days).toHaveLength(6 + 30);
      expect(calendar.days[6 + 1].state).toBe('completed');
      expect(calendar.days[6 + 17].state).toBe('today');
      expect(calendar.days[6 + 18].state).toBe('future');
    });

    it('shows unscheduled past days as pause and missed days plain', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Course',
        frequency: 'custom',
        days: MONDAY_ONLY,
        completedDates: ['2026-11-16'],
      });

      const calendar = buildDetailCalendar(habit, new Date(2026, 10, 1), reference);

      // Monday-only habit: Monday 9 is scheduled and missed (plain cell),
      // Tuesday 10 is a rest day → "pause douce".
      expect(calendar.days[6 + 8].state).toBe('missed');
      expect(calendar.days[6 + 9].state).toBe('pause');
    });

    it('stops navigation before the habit was created', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        createdAt: '2026-11-15',
      });

      const calendar = buildDetailCalendar(habit, new Date(2026, 10, 1), reference);

      expect(calendar.canGoPrev).toBe(false);
    });

    it('allows navigating back and forth on a past month', () => {
      const habit = makeHabit({ id: 1, title: 'Méditation', createdAt: '2026-09-10' });

      const calendar = buildDetailCalendar(habit, new Date(2026, 9, 1), reference);

      expect(calendar.canGoPrev).toBe(true);
      expect(calendar.canGoNext).toBe(true);
    });
  });

  describe('buildDetailHistory', () => {
    it('labels the latest completions, newest first', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        time: '08:00',
        completedDates: ['2026-11-02', '2026-11-17', '2026-11-18', '2026-11-16'],
      });

      const history = buildDetailHistory(habit, reference);

      expect(history.map((entry) => entry.title)).toEqual([
        'Aujourd’hui (18 nov.)',
        'Hier (17 nov.)',
        'Lundi 16 nov.',
        'Lundi 2 nov.',
      ]);
      expect(history[0].today).toBe(true);
      expect(history[0].time).toBe('08:00');
    });

    it('keeps at most five entries', () => {
      const habit = makeHabit({
        id: 1,
        title: 'Méditation',
        completedDates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'],
      });

      expect(buildDetailHistory(habit, reference)).toHaveLength(5);
    });

    it('falls back to a generic note without a done note', () => {
      const habit = makeHabit({ id: 1, title: 'Méditation', completedDates: ['2026-11-17'] });

      expect(buildDetailHistory(habit, reference)[0].note).toBe('Séance validée');
    });
  });
});
