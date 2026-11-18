import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import type { PermissionState } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

import { addDays, startOfDay } from '../models/date.model';

import type { Habit, HabitSection } from './habit.service';
import { HabitService } from './habit.service';
import { QuietHoursService } from './quiet-hours.service';
import { TranslationService } from './translation.service';

/**
 * How many days ahead each habit's reminders are planned. Each app start
 * re-syncs (and extends) the window, so reminders keep rolling forward as
 * long as the app is opened at least weekly.
 */
const SCHEDULE_WINDOW_DAYS = 7;

/** Android notification channel used by every habit reminder. */
const CHANNEL_ID = 'habit-reminders';

/** Key used to persist the profile-page "Rappels & Notifications" switch. */
const REMINDERS_STORAGE_KEY = 'zen-reminders-enabled';

/** Extra payload field carrying the habit id inside each notification. */
const EXTRA_HABIT_ID = 'habitId';

export interface ReminderOccurrence {
  habit: Habit;
  /** Exact local date & time the reminder should fire. */
  when: Date;
}

/**
 * Schedules local notifications for the habits the user wants to be
 * reminded about. Works on both platforms:
 *
 * - Android: `@capacitor/local-notifications` schedules real alarms through
 *   AlarmManager (they fire even when the app is closed). A dedicated
 *   notification channel is created once, and exact alarms are not required
 *   so the OS never redirects to the "Alarms & reminders" settings screen.
 * - Web: the plugin's web implementation uses the browser Notification API;
 *   browsers only honor exact times (`schedule.at`) while the app is open,
 *   so occurrences are planned day by day like on Android.
 *
 * The schedule is rebuilt whenever the habit list changes: pending
 * notifications are cancelled and replaced, so reminders always mirror the
 * habits currently stored (including deleted or rescheduled ones).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly habitService = inject(HabitService);
  private readonly quietHours = inject(QuietHoursService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);

  /** Whether the current platform can schedule notifications at all. */
  readonly isSupported: boolean = Capacitor.isNativePlatform() || typeof Notification !== 'undefined';

  /** The profile-page switch, restored from storage (off by default). */
  readonly remindersEnabled = signal(false);

  /** Whether the persisted switch value has been read back from storage. */
  private readonly restored = signal(false);

  /** Resolves once the persisted switch value has been read back from storage. */
  readonly ready: Promise<void>;

  /** OS/browser permission to display notifications. */
  readonly permission = signal<PermissionState>('prompt');

  /** Whether reminders should currently be scheduled. */
  readonly canSchedule = computed(() => this.remindersEnabled() && this.permission() === 'granted');

  constructor() {
    // Rebuild the schedule whenever the habits, the switch or the
    // permission state change — but only once the stored switch value is
    // known, so the default never schedules reminders for a user who
    // turned them off.
    effect(() => {
      if (!this.restored() || !this.quietHours.restored()) {
        return;
      }
      const sections = this.habitService.sections();
      const enabled = this.remindersEnabled();
      const permission = this.permission();
      // Quiet-hours changes must rebuild the schedule so silenced reminders
      // are dropped (or restored) immediately.
      this.quietHours.enabled();
      this.quietHours.startTime();
      this.quietHours.endTime();
      // Rebuild the pending notifications when the language changes too, so
      // already-scheduled reminders match the app language.
      this.translation.lang();
      void untracked(() => this.syncReminders(enabled, permission, sections));
    });

    this.ready = this.restore();
  }

  /** Restores the persisted switch value (absent key = never touched = off). */
  private async restore(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: REMINDERS_STORAGE_KEY });
      this.remindersEnabled.set(value === 'true');
    } catch {
      // Storage unavailable: keep the default (off).
    }
    this.restored.set(true);
  }

  /** Called once at app start: prepares the channel, the permission state and the tap listener. */
  async init(): Promise<void> {
    if (!this.isSupported) {
      return;
    }
    await this.createChannel();
    await this.refreshPermission();
    void this.registerTapListener();
  }

  /**
   * Turns reminders on (profile switch / saving a habit with a reminder):
   * asks for the OS permission first and only stores "enabled" when granted.
   * Returns the resulting permission state.
   */
  async enable(): Promise<PermissionState> {
    if (!this.isSupported) {
      return 'prompt';
    }
    await this.requestPermission();
    if (this.permission() === 'granted') {
      this.remindersEnabled.set(true);
      await this.persist(true);
    }
    return this.permission();
  }

  /** Turns reminders off (profile switch): stops scheduling and cancels everything pending. */
  async disable(): Promise<void> {
    this.remindersEnabled.set(false);
    await this.persist(false);
  }

  /** Asks the OS/browser for the notification permission and mirrors the result. */
  async requestPermission(): Promise<PermissionState> {
    if (!this.isSupported) {
      return 'prompt';
    }
    try {
      const { display } = await LocalNotifications.requestPermissions();
      this.permission.set(display);
    } catch {
      // Unsupported browser (no Notification API): keep the prompt state.
    }
    return this.permission();
  }

  /** Re-reads the current permission without prompting. */
  async refreshPermission(): Promise<void> {
    if (!this.isSupported) {
      return;
    }
    try {
      const { display } = await LocalNotifications.checkPermissions();
      this.permission.set(display);
    } catch {
      // Unsupported browser: keep the prompt state.
    }
  }

  /** Builds every notification that should be scheduled right now. */
  buildReminders(sections: HabitSection[], from: Date = new Date()): LocalNotificationSchema[] {
    const notifications: LocalNotificationSchema[] = [];

    for (const section of sections) {
      for (const habit of section.habits) {
        if (!habit.reminderEnabled || !habit.time) {
          continue;
        }
        for (const occurrence of this.upcomingOccurrences(habit, from)) {
          // Quiet hours keep the phone silent: occurrences inside the window
          // are not scheduled at all.
          if (this.quietHours.isSilenced(occurrence.when)) {
            continue;
          }
          notifications.push({
            id: notificationId(habit.id, occurrence),
            title: this.translation.t('notification.reminderTitle', { title: habit.title }),
            body: this.translation.t('notification.reminderBody'),
            // Inexact alarms avoid the Android 12+ exact-alarm settings
            // redirect; habit reminders don't need second-level precision.
            isExactNotification: false,
            schedule: {
              at: occurrence.when,
              allowWhileIdle: true,
            },
            channelId: CHANNEL_ID,
            extra: { [EXTRA_HABIT_ID]: habit.id },
          });
        }
      }
    }

    return notifications;
  }

  /**
   * Every firing time of a habit inside the schedule window (today included,
   * times already passed excluded), following the habit's weekly schedule.
   */
  upcomingOccurrences(habit: Habit, from: Date = new Date()): ReminderOccurrence[] {
    const time = parseReminderTime(habit.time ?? '');
    if (!time) {
      return [];
    }

    const occurrences: ReminderOccurrence[] = [];
    const base = startOfDay(from);

    for (let offset = 0; offset < SCHEDULE_WINDOW_DAYS; offset++) {
      const day = addDays(base, offset);
      if (!this.isScheduledOn(habit, day)) {
        continue;
      }
      const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hour, time.minute);
      if (when.getTime() <= from.getTime()) {
        continue;
      }
      occurrences.push({ habit, when });
    }

    return occurrences;
  }

  /** Whether the habit is planned on the given day, from its weekly schedule. */
  isScheduledOn(habit: Habit, day: Date): boolean {
    // "daily" habits (and habits with an empty/degenerate schedule) repeat every day.
    if (!habit.days || habit.days.length !== 7 || !habit.days.some(Boolean)) {
      return true;
    }
    const dayIndex = (day.getDay() + 6) % 7; // Monday = 0 (same convention as the stats model)
    return habit.days[dayIndex] === true;
  }

  private async syncReminders(enabled: boolean, permission: PermissionState, sections: HabitSection[]): Promise<void> {
    if (!this.isSupported) {
      return;
    }

    const notifications = enabled && permission === 'granted' ? this.buildReminders(sections) : [];

    try {
      // The pending list is rebuilt from scratch so removed or rescheduled
      // habits never leave stale notifications behind.
      await LocalNotifications.cancelAll();
      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
    } catch {
      // Scheduling can fail while the permission is being revoked or on
      // unsupported browsers: the reminders simply stay silent.
    }
  }

  private async createChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: this.translation.t('notification.channelName'),
        description: this.translation.t('notification.channelDescription'),
        importance: 3,
        vibration: true,
      });
    } catch {
      // Channel creation is a nice-to-have: notifications still work with
      // the default channel if this fails.
    }
  }

  private async registerTapListener(): Promise<void> {
    try {
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const habitId = action.notification.extra?.[EXTRA_HABIT_ID];
        if (typeof habitId === 'number' && this.habitService.findHabit(habitId)) {
          void this.router.navigate(['/habit', habitId]);
        }
      });
    } catch {
      // Tap navigation is optional: notifications remain functional.
    }
  }

  private async persist(enabled: boolean): Promise<void> {
    try {
      await Preferences.set({ key: REMINDERS_STORAGE_KEY, value: String(enabled) });
    } catch {
      // Storage unavailable: the choice simply won't survive a reload.
    }
  }
}

/** Unique notification id for a habit occurrence (Android ids are 32-bit ints). */
function notificationId(habitId: number, occurrence: ReminderOccurrence): number {
  // Day offset within the (7-day) window keeps ids small and stable per habit.
  const dayOffset = Math.floor((startOfDay(occurrence.when).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  return habitId * 10 + Math.max(0, Math.min(SCHEDULE_WINDOW_DAYS - 1, dayOffset));
}

/** Parses a `HH:mm` reminder time into local hours and minutes. */
function parseReminderTime(value: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return undefined;
  }
  return { hour, minute };
}
