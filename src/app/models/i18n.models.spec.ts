import type { Habit, HabitSection } from '../services/habit.service';

import { buildDetailCalendar, buildDetailHistory, buildHabitKpis } from './habit-detail.model';
import { describeSchedule } from './habit-schedule.model';
import { buildStats } from './stats.model';

const REFERENCE = new Date(2026, 10, 18); // Wed Nov 18, 2026

function makeSections(): HabitSection[] {
  return [
    {
      id: 'morning',
      label: 'Matin',
      icon: 'wb_twilight',
      habits: [
        {
          id: 1,
          title: 'Méditation',
          icon: 'self_improvement',
          iconClass: 'habit-card__icon--mint',
          state: 'done',
          time: '08:00',
          frequency: 'daily',
          days: [true, true, true, true, true, true, true],
          goal: 1,
          completedDates: ['2026-11-18'],
          createdAt: '2026-11-01',
        },
      ],
    },
  ];
}

function makeHabit(): Habit {
  return makeSections()[0].habits[0];
}

describe('English translations in the data models', () => {
  it('builds the statistics summary in English', () => {
    const stats = buildStats(makeSections(), 'week', REFERENCE, 'en');

    expect(stats.rhythmTitle).toBe('Weekly rhythm');
    expect(stats.snapshotTitle).toBe('Week snapshots');
    expect(stats.goalLabel).toBe('In progress');
    expect(stats.rhythmDays.map((day) => day.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(stats.snapshots.map((snapshot) => snapshot.title)).toContain('Completion volume');
    expect(stats.categories[0].name).toBe('Mind & Serenity');
    expect(stats.badges.map((badge) => badge.title)).toContain('7 days of consistency');
  });

  it('keeps the French statistics summary by default', () => {
    const stats = buildStats(makeSections(), 'week', REFERENCE);

    expect(stats.rhythmTitle).toBe('Rythme de la semaine');
    expect(stats.categories[0].name).toBe('Esprit & Sérénité');
  });

  it('builds the habit detail figures in English', () => {
    const habit = makeHabit();

    expect(buildHabitKpis(habit, REFERENCE, 'en').map((kpi) => kpi.label)).toEqual([
      'Current streak',
      'Best result',
      'Success rate',
      'Total completed',
    ]);
    expect(buildDetailCalendar(habit, new Date(2026, 10, 1), REFERENCE, 'en').label).toBe('November 2026');
    expect(buildDetailCalendar(habit, new Date(2026, 10, 1), REFERENCE, 'en').count).toBe('1 session completed');
    expect(buildDetailHistory(habit, REFERENCE, 'en')[0].title).toBe('Today (18 Nov)');
  });

  it('describes schedules in the requested language', () => {
    const week = [true, false, false, false, false, false, false];

    expect(describeSchedule('weekly', week, 1, 'en')).toBe('Every Monday');
    expect(describeSchedule('weekly', week, 1, 'fr')).toBe('Chaque lundi');
    expect(describeSchedule('daily', week, 2, 'en')).toBe('Every day · 2× per day');
  });
});
