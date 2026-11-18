import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { buildWeekStrip } from '../models/dayStrip.model';
import { describeSchedule } from '../models/habit-schedule.model';
import type { Habit, HabitSection, Moment } from '../services/habit.service';
import { HabitService } from '../services/habit.service';
import { TranslationService } from '../services/translation.service';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';

export interface Filter {
  id: 'all' | Moment;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [AppHeaderComponent, IonContent, RouterLink],
})
export class HomePage implements OnInit {
  today: Date = new Date();
  private readonly habitService = inject(HabitService);
  private readonly translation = inject(TranslationService);

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);

  /** Full localized date shown above the greeting. */
  readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat(this.translation.locale, { dateStyle: 'full' }).format(this.today),
  );

  /** Habit sections come from the shared store (add-habit writes to it too). */
  readonly sections = this.habitService.sections;

  readonly filters = computed<Filter[]>(() => [
    { id: 'all', label: this.t('filter.all') },
    { id: 'morning', label: this.t('moment.morning'), icon: 'wb_twilight' },
    { id: 'afternoon', label: this.t('moment.afternoon'), icon: 'light_mode' },
    { id: 'evening', label: this.t('moment.evening'), icon: 'bedtime' },
  ]);

  readonly selectedFilter = signal<Filter['id']>('all');

  readonly selectedDay = signal(0);

  /** Dates with at least one completed habit, used by the weekly strip. */
  readonly completedDates = computed(() => {
    const dates = new Set<string>();
    for (const section of this.sections()) {
      for (const habit of section.habits) {
        for (const date of habit.completedDates ?? []) {
          dates.add(date);
        }
      }
    }
    return dates;
  });

  readonly days = computed(() => buildWeekStrip(this.today, this.completedDates(), this.translation.lang()));

  ngOnInit(): void {
    const todayIndex = this.days().findIndex((day) => day.dot === 'today');
    this.selectedDay.set(todayIndex >= 0 ? todayIndex : 0);
  }

  readonly totalCount = computed(() => this.sections().reduce((sum, section) => sum + section.habits.length, 0));

  readonly doneCount = computed(
    () =>
      this.sections()
        .flatMap((section) => section.habits)
        .filter((habit) => habit.state === 'done').length,
  );

  readonly progressPercent = computed(() => {
    const total = this.totalCount();
    return total === 0 ? 0 : Math.round((this.doneCount() / total) * 100);
  });

  readonly visibleSections = computed(() => {
    const filter = this.selectedFilter();
    return filter === 'all' ? this.sections() : this.sections().filter((section) => section.id === filter);
  });

  readonly ringOffset = computed(() => {
    const circumference = 113.1;
    const total = this.totalCount();
    const ratio = total === 0 ? 0 : this.doneCount() / total;
    return circumference * (1 - ratio);
  });

  habitsDone(section: HabitSection): number {
    return section.habits.filter((habit) => habit.state === 'done').length;
  }

  /**
   * Detail line under a habit title (frequency, goal…). Rebuilt from the
   * structured schedule so it always matches the current language; habits
   * stored before those fields existed fall back to their original text.
   */
  scheduleDetail(habit: Habit): string | undefined {
    if (!habit.frequency) {
      return habit.detail;
    }
    return describeSchedule(habit.frequency, habit.days ?? [], habit.goal ?? 1, this.translation.lang());
  }

  selectFilter(filterId: Filter['id']): void {
    this.selectedFilter.set(filterId);
  }

  selectDay(index: number): void {
    this.selectedDay.set(index);
  }

  toggle(habit: Habit): void {
    this.habitService.toggle(habit.id);
  }
}
