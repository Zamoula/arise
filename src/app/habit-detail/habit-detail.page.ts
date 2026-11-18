import { Location } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonModal } from '@ionic/angular';

import { startOfMonth } from '../models/date.model';
import { buildDetailCalendar, buildDetailHistory, buildHabitKpis, shiftMonth } from '../models/habit-detail.model';
import type {
  CalendarDay,
  CalendarDayState,
  DetailCalendar,
  HabitKpi,
  HistoryEntry,
} from '../models/habit-detail.model';
import { describeSchedule } from '../models/habit-schedule.model';
import type { Habit } from '../services/habit.service';
import { HabitService } from '../services/habit.service';
import { NotificationService } from '../services/notification.service';
import { TranslationService } from '../services/translation.service';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';

export type { CalendarDay, CalendarDayState, HabitKpi, HistoryEntry };

/** Stand-in used to render the calendar when the route points nowhere. */
const UNKNOWN_HABIT: Habit = {
  id: 0,
  title: '',
  icon: '',
  iconClass: '',
  state: 'todo',
  frequency: 'daily',
};

@Component({
  selector: 'app-habit-detail',
  templateUrl: 'habit-detail.page.html',
  styleUrls: ['habit-detail.page.scss'],
  imports: [AppHeaderComponent, FormsModule, IonContent, IonModal],
})
export class HabitDetailPage {
  /** Bound from the route parameter via withComponentInputBinding. */
  readonly id = input<string>();

  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly habitService = inject(HabitService);
  private readonly notificationService = inject(NotificationService);
  private readonly translation = inject(TranslationService);

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);

  /** Short weekday initials for the calendar, Monday first. */
  readonly weekdayLabels = computed(() =>
    ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun'].map(
      (key) => this.t(key),
    ),
  );

  /** The stored habit, when the route points at a real one. */
  readonly habit = computed(() => {
    const id = Number.parseInt(this.id() ?? '', 10);
    return Number.isNaN(id) ? undefined : this.habitService.findHabit(id);
  });

  /** Frequency and reminder, falling back to the design copy. */
  readonly scheduleLabel = computed(() => {
    const habit = this.habit();
    if (!habit) {
      return this.t('detail.scheduleDailyAt', { time: '08:00' });
    }
    const frequency = habit.frequency
      ? describeSchedule(habit.frequency, habit.days ?? [], habit.goal ?? 1, this.translation.lang())
      : (habit.detail ?? this.t('frequency.daily'));
    return habit.time ? this.t('detail.scheduleAt', { schedule: frequency, time: habit.time }) : frequency;
  });

  readonly avatarUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuASvncCQqmIar0mIj7oRzWw_y7NVYGOssOmWS0VpIcP60cdVGgMH9r5wsSa3UaW_fya8TeG1RxSzL4KEdCqH6_kpMA180gbOAmc2Ho_vBpKoOk5-BFgiPo1gAxdTbR_RSGKdHuDWsAnWh2aDkS7HOlq-_3Mc65a86f6eqJMzTT7KKcmRMmZwyfEdFz-KWDu_IXQp0yIOhBlegrXTPoZ9nM229xKXlMrdTHmkXlDmstV';

  /** Month shown in the calendar, defaults to the current one. */
  readonly displayedMonth = signal(startOfMonth(new Date()));

  readonly isPaused = signal(false);

  readonly statusLabel = computed(() =>
    this.isPaused() ? this.t('detail.statusPaused') : this.t('detail.statusActive'),
  );

  /** Key figures derived from the habit's completion history. */
  readonly kpis = computed<HabitKpi[]>(() => {
    const habit = this.habit();
    return habit ? buildHabitKpis(habit, new Date(), this.translation.lang()) : [];
  });

  /** Completions shown in the "Historique récent" card, newest first. */
  readonly history = computed<HistoryEntry[]>(() => {
    const habit = this.habit();
    return habit ? buildDetailHistory(habit, new Date(), this.translation.lang()) : [];
  });

  readonly historyCountLabel = computed(() => {
    const count = this.history().length;
    return count === 0 ? this.t('detail.historyEmpty') : this.t('detail.historyCount', { count });
  });

  /** Calendar for the displayed month, from the habit's completion history. */
  readonly calendar = computed<DetailCalendar>(() =>
    buildDetailCalendar(this.habit() ?? UNKNOWN_HABIT, this.displayedMonth(), new Date(), this.translation.lang()),
  );

  /** Whether the "Ajuster l'heure" sheet is open. */
  readonly scheduleOpen = signal(false);

  /** Draft values edited inside the "Ajuster l'heure" sheet. */
  readonly draftReminderEnabled = signal(false);
  readonly draftReminderTime = signal('');

  /** Save is blocked while the reminder is on without a valid `HH:mm` time. */
  readonly canSaveSchedule = computed(
    () => !this.draftReminderEnabled() || /^\d{2}:\d{2}$/.test(this.draftReminderTime()),
  );

  togglePause(): void {
    this.isPaused.set(!this.isPaused());
  }

  goToPreviousMonth(): void {
    if (this.calendar().canGoPrev) {
      this.displayedMonth.update((month) => shiftMonth(month, -1));
    }
  }

  goToNextMonth(): void {
    if (this.calendar().canGoNext) {
      this.displayedMonth.update((month) => shiftMonth(month, 1));
    }
  }

  goBack(): void {
    this.location.back();
  }

  editHabit(): void {
    const id = this.id();
    if (id) {
      void this.router.navigate(['/habit', id, 'edit']);
    }
  }

  /** Opens the "Ajuster l'heure" sheet prefilled with the current schedule. */
  adjustSchedule(): void {
    const habit = this.habit();
    if (!habit) {
      return;
    }
    this.draftReminderEnabled.set(habit.reminderEnabled ?? Boolean(habit.time));
    this.draftReminderTime.set(habit.time ?? '08:00');
    this.scheduleOpen.set(true);
  }

  closeSchedule(): void {
    this.scheduleOpen.set(false);
  }

  toggleDraftReminder(): void {
    this.draftReminderEnabled.set(!this.draftReminderEnabled());
  }

  /** Applies the draft schedule and keeps the notifications in sync. */
  saveSchedule(): void {
    const habit = this.habit();
    if (!habit || !this.canSaveSchedule()) {
      return;
    }

    const reminderEnabled = this.draftReminderEnabled();
    this.habitService.updateHabitSchedule(habit.id, reminderEnabled, this.draftReminderTime());
    if (reminderEnabled && !this.notificationService.canSchedule()) {
      // Asks for the OS permission (no-op when already granted); the
      // notification service then rebuilds the pending reminders itself.
      void this.notificationService.enable();
    }
    this.scheduleOpen.set(false);
  }
}
