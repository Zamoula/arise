import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

import type { Badge, CategoryBalance, RhythmDay, Snapshot, StatsPeriod, StatsSummary } from '../models/stats.model';
import { buildStats } from '../models/stats.model';
import { HabitService } from '../services/habit.service';
import { TranslationService } from '../services/translation.service';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';

export type { Badge, CategoryBalance, RhythmDay, Snapshot, StatsPeriod, StatsSummary };

@Component({
  selector: 'app-stats',
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss'],
  imports: [AppHeaderComponent, IonContent, RouterLink],
})
export class StatsPage {
  private readonly habitService = inject(HabitService);
  private readonly translation = inject(TranslationService);

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);

  readonly periods = computed<{ id: StatsPeriod; label: string }[]>(() => [
    { id: 'week', label: this.t('period.week') },
    { id: 'month', label: this.t('period.month') },
    { id: 'year', label: this.t('period.year') },
  ]);

  readonly selectedPeriod = signal<StatsPeriod>('week');

  readonly bannerVisible = signal(true);

  /** Everything displayed by the page, derived from the stored habits. */
  readonly stats = computed(() =>
    buildStats(this.habitService.sections(), this.selectedPeriod(), new Date(), this.translation.lang()),
  );

  /** 7 columns for a week, 5–6 for a month and 12 for a year. */
  readonly rhythmColumns = computed(() => `repeat(${this.stats().rhythmDays.length}, 1fr)`);

  private readonly selectedDay = signal<RhythmDay | null>(null);

  readonly dayFeedback = computed(() => {
    const day = this.selectedDay();
    if (!day) {
      return this.stats().feedback;
    }
    if (day.future) {
      return this.t('stats.dayUpcoming', { day: day.label });
    }
    if (day.pause) {
      return this.t('stats.dayRest', { day: day.label });
    }
    return this.t('stats.dayRate', {
      day: day.label,
      percent: day.percent,
      completed: day.completed,
      expected: day.expected,
    });
  });

  readonly dayFeedbackHighlighted = computed(() => this.selectedDay() !== null);

  selectPeriod(period: StatsPeriod): void {
    this.selectedPeriod.set(period);
    this.selectedDay.set(null);
  }

  dismissBanner(): void {
    this.bannerVisible.set(false);
  }

  selectDay(day: RhythmDay): void {
    this.selectedDay.set(day);
  }

  pauseHabits(): void {
    // Placeholder until the "Mettre en pause" flow is wired up.
  }
}
