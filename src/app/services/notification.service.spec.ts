import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import type { Habit, HabitSection } from './habit.service';
import { NotificationService } from './notification.service';
import { QuietHoursService } from './quiet-hours.service';

/** Daily 08:00 habit used as the base for most tests. */
function dailyHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 1,
    title: 'Méditation guidée',
    icon: 'self_improvement',
    iconClass: 'habit-card__icon--mint',
    state: 'todo',
    time: '08:00',
    reminderEnabled: true,
    frequency: 'daily',
    days: [true, true, true, true, true, true, true],
    goal: 1,
    ...overrides,
  };
}

function sectionWith(habits: Habit[]): HabitSection[] {
  return [{ id: 'morning', label: 'Matin', icon: 'wb_twilight', habits }];
}

function atTime(date: Date, hours: number, minutes: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

/**
 * Number of future occurrences of a daily `HH:mm` habit within the 7-day
 * window: today counts only when its reminder time is still ahead.
 */
function expectedDailyCount(now: Date, hours: number, minutes: number): number {
  return atTime(now, hours, minutes).getTime() > now.getTime() ? 7 : 6;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let now: Date;

  beforeEach(async () => {
    localStorage.clear();
    // Keep the plugin's unprefixed keys (as configured at app startup) so the
    // specs can seed and assert through localStorage directly.
    await Preferences.configure({ group: 'NativeStorage' });
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
    // The persisted switch value is restored asynchronously.
    await service.ready;
    await TestBed.inject(QuietHoursService).ready;
    now = new Date();
  });

  it('plans the next occurrences of a daily habit inside the window', () => {
    const occurrences = service.upcomingOccurrences(dailyHabit());

    expect(occurrences.length).toBe(expectedDailyCount(now, 8, 0));
    // Every occurrence is at 08:00 and strictly after "now".
    for (const occurrence of occurrences) {
      expect(occurrence.when.getHours()).toBe(8);
      expect(occurrence.when.getMinutes()).toBe(0);
      expect(occurrence.when.getTime()).toBeGreaterThan(now.getTime());
    }
    // The first occurrence is today 08:00 when it is still ahead of "now",
    // otherwise tomorrow 08:00.
    const todayEight = atTime(now, 8, 0);
    const first =
      todayEight.getTime() > now.getTime()
        ? todayEight
        : atTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), 8, 0);
    expect(occurrences[0].when.getTime()).toBe(first.getTime());
  });

  it('never plans a reminder for a time that already passed today', () => {
    // "now" is just before midnight, so today's 23:59 is still ahead.
    const lateToday = atTime(now, 23, 59);
    if (lateToday.getTime() <= now.getTime()) {
      return; // the test only makes sense when run before 23:59
    }
    const occurrences = service.upcomingOccurrences(dailyHabit({ time: '23:59' }), lateToday);

    expect(occurrences.length).toBe(6);
    for (const occurrence of occurrences) {
      expect(occurrence.when.getTime()).toBeGreaterThan(lateToday.getTime());
    }
  });

  it('follows the Monday-first weekly schedule of custom habits', () => {
    const habit = dailyHabit({
      frequency: 'custom',
      // [Mon, Tue, Wed, Thu, Fri, Sat, Sun] — only Wednesday & Sunday
      days: [false, false, true, false, false, false, true],
    });

    // Expected weekdays, mirroring the window rules (future times only).
    const expectedDays = new Set<number>();
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const dayIndex = (day.getDay() + 6) % 7;
      if (dayIndex !== 2 && dayIndex !== 6) {
        continue;
      }
      if (atTime(day, 8, 0).getTime() > now.getTime()) {
        expectedDays.add(dayIndex);
      }
    }

    const scheduledDays = new Set(
      service.upcomingOccurrences(habit).map((occurrence) => (occurrence.when.getDay() + 6) % 7),
    );

    expect([...scheduledDays].sort((a, b) => a - b)).toEqual([...expectedDays].sort((a, b) => a - b));
  });

  it('repeats every day when the weekly schedule is empty', () => {
    const habit = dailyHabit({ frequency: 'weekly', days: [false, false, false, false, false, false, false] });

    const occurrences = service.upcomingOccurrences(habit);

    expect(occurrences.length).toBe(expectedDailyCount(now, 8, 0));
  });

  it('skips habits without a reminder', () => {
    const notifications = service.buildReminders(
      sectionWith([dailyHabit({ reminderEnabled: false }), dailyHabit({ id: 2, time: undefined })]),
    );

    expect(notifications).toEqual([]);
  });

  it('builds one notification per occurrence with a unique id', () => {
    const notifications = service.buildReminders(sectionWith([dailyHabit({ id: 3 })]));

    expect(notifications.length).toBe(expectedDailyCount(now, 8, 0));
    const ids = new Set(notifications.map((notification) => notification.id));
    expect(ids.size).toBe(notifications.length);
    expect(notifications[0].title).toBe('Rappel : Méditation guidée');
    expect(notifications[0].extra).toEqual({ habitId: 3 });
    expect(notifications[0].schedule?.at).toBeInstanceOf(Date);
  });

  it('skips occurrences that fall inside the quiet-hours window', async () => {
    const quietHours = TestBed.inject(QuietHoursService);
    await quietHours.setStartTime('07:00');
    await quietHours.setEndTime('09:00');

    // The base habit fires at 08:00, inside the window.
    expect(service.buildReminders(sectionWith([dailyHabit()]))).toEqual([]);

    // Moving the window away from 08:00 brings the reminders back.
    await quietHours.setEndTime('07:30');

    expect(service.buildReminders(sectionWith([dailyHabit()])).length).toBe(expectedDailyCount(now, 8, 0));
  });

  it('starts off when the switch was never touched', async () => {
    expect(service.remindersEnabled()).toBe(false);
    expect(localStorage.getItem('zen-reminders-enabled')).toBeNull();
  });

  it('restores the persisted switch value across sessions', async () => {
    localStorage.setItem('zen-reminders-enabled', 'true');
    // A fresh injector mimics a new app session reading storage at startup.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(NotificationService);

    await reloaded.ready;

    expect(reloaded.remindersEnabled()).toBe(true);
  });

  it('does not plan reminders while the feature is disabled', async () => {
    await service.disable();

    expect(service.remindersEnabled()).toBe(false);
    expect(localStorage.getItem('zen-reminders-enabled')).toBe('false');
  });
});
