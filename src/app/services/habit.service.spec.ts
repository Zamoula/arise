import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import type { Habit, NewHabit } from '../services/habit.service';

import { HabitService } from './habit.service';

const BASE_HABIT: NewHabit = {
  title: 'Méditation guidée',
  icon: 'self_improvement',
  iconClass: 'habit-card__icon--mint',
  reminderEnabled: true,
  reminderTime: '08:00',
  detail: 'Tous les jours',
  frequency: 'daily',
  days: [true, true, true, true, true, true, true],
  goal: 1,
};

function todayIso(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

describe('HabitService', () => {
  let service: HabitService;

  beforeEach(async () => {
    localStorage.clear();
    // Keep the plugin's unprefixed keys (as configured at app startup) so the
    // specs can seed and assert through localStorage directly.
    await Preferences.configure({ group: 'NativeStorage' });
    TestBed.configureTestingModule({});
    service = TestBed.inject(HabitService);
    // The sections are restored asynchronously from @capacitor/preferences.
    await service.ready;
  });

  it('creates a habit in the section matching its reminder time', () => {
    service.addHabit(BASE_HABIT);

    const habit = service.findHabit(1);
    expect(habit?.title).toBe('Méditation guidée');
    expect(service.sections()[0].habits).toContain(habit);
  });

  it('updates a habit while keeping its completion state', () => {
    service.addHabit(BASE_HABIT);
    service.toggle(1);

    service.updateHabit(1, {
      ...BASE_HABIT,
      title: 'Méditation du soir',
      reminderTime: '19:30',
      frequency: 'weekly',
      days: [true, false, false, false, false, false, false],
      goal: 2,
    });

    const updated = service.findHabit(1);
    expect(updated?.title).toBe('Méditation du soir');
    expect(updated?.state).toBe('done');
    expect(updated?.time).toBe('19:30');
    expect(updated?.frequency).toBe('weekly');
    expect(updated?.goal).toBe(2);
  });

  it('moves a habit to another section when its reminder time changes', () => {
    service.addHabit(BASE_HABIT);
    service.updateHabit(1, { ...BASE_HABIT, reminderTime: '19:30' });

    const morning = service.sections().find((section) => section.id === 'morning');
    const evening = service.sections().find((section) => section.id === 'evening');
    expect(morning?.habits).toHaveLength(0);
    expect(evening?.habits.map((habit: Habit) => habit.id)).toContain(1);
  });

  it('ignores updates for unknown habits', () => {
    expect(() => service.updateHabit(99, BASE_HABIT)).not.toThrow();
  });

  describe('updateHabitSchedule', () => {
    it('updates only the reminder time and keeps everything else', () => {
      service.addHabit(BASE_HABIT);
      service.toggle(1);

      service.updateHabitSchedule(1, true, '06:30');

      const updated = service.findHabit(1);
      expect(updated?.time).toBe('06:30');
      expect(updated?.reminderEnabled).toBe(true);
      expect(updated?.title).toBe(BASE_HABIT.title);
      expect(updated?.frequency).toBe('daily');
      expect(updated?.state).toBe('done');
      expect(updated?.completedDates).toEqual([todayIso()]);
    });

    it('moves the habit to the section matching the new time', () => {
      service.addHabit(BASE_HABIT);

      service.updateHabitSchedule(1, true, '21:00');

      const morning = service.sections().find((section) => section.id === 'morning');
      const evening = service.sections().find((section) => section.id === 'evening');
      expect(morning?.habits).toHaveLength(0);
      expect(evening?.habits.map((habit: Habit) => habit.id)).toContain(1);
    });

    it('can turn the reminder off', () => {
      service.addHabit(BASE_HABIT);

      service.updateHabitSchedule(1, false, '');

      const updated = service.findHabit(1);
      expect(updated?.reminderEnabled).toBe(false);
      expect(updated?.time).toBeUndefined();
    });

    it('ignores unknown habits', () => {
      expect(() => service.updateHabitSchedule(99, true, '08:00')).not.toThrow();
    });
  });

  it('records today when a habit is completed and removes it when undone', () => {
    service.addHabit(BASE_HABIT);

    service.toggle(1);
    expect(service.findHabit(1)?.state).toBe('done');
    expect(service.findHabit(1)?.completedDates).toEqual([todayIso()]);

    service.toggle(1);
    expect(service.findHabit(1)?.state).toBe('todo');
    expect(service.findHabit(1)?.completedDates).toEqual([]);
  });

  it('stores the creation date so stats ignore days before the habit existed', () => {
    service.addHabit(BASE_HABIT);

    expect(service.findHabit(1)?.createdAt).toBe(todayIso());
  });

  it('migrates a legacy done habit to today’s history', async () => {
    localStorage.setItem(
      'zen-habits-v1',
      JSON.stringify([
        {
          id: 'morning',
          label: 'Matin',
          icon: 'wb_twilight',
          habits: [
            {
              id: 1,
              title: 'Méditation guidée',
              icon: 'self_improvement',
              iconClass: 'habit-card__icon--mint',
              state: 'done',
            },
          ],
        },
      ]),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const migrated = TestBed.inject(HabitService);
    await migrated.ready;

    expect(migrated.findHabit(1)?.completedDates).toEqual([todayIso()]);
    expect(migrated.findHabit(1)?.state).toBe('done');
  });
});
