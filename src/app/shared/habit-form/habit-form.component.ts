import type { OnInit } from '@angular/core';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { describeSchedule } from '../../models/habit-schedule.model';
import type { Frequency, Habit, NewHabit } from '../../services/habit.service';
import { TranslationService } from '../../services/translation.service';

export type IconOption =
  | 'water_drop'
  | 'menu_book'
  | 'fitness_center'
  | 'self_improvement'
  | 'bedtime'
  | 'edit_note'
  | 'park'
  | 'directions_bike';

export type ColorOption = 'mint' | 'blue' | 'amber' | 'tertiary' | 'surface' | 'primaryFixed';

export type FrequencyOption = Frequency;

interface Suggestion {
  emojiLabel: string;
  name: string;
  icon: IconOption;
  color: ColorOption;
}

interface ScheduleValues {
  frequency: FrequencyOption;
  days: boolean[];
  goal: number;
}

/**
 * Shared create/edit form. The page owning it decides what to do with the
 * submitted values (create a habit or update an existing one).
 */
@Component({
  selector: 'app-habit-form',
  templateUrl: './habit-form.component.html',
  styleUrls: ['./habit-form.component.scss'],
  imports: [FormsModule],
})
export class HabitFormComponent implements OnInit {
  private readonly translation = inject(TranslationService);

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);

  /** "create" gives the add wording, "edit" gives the update wording. */
  readonly mode = input<'create' | 'edit'>('create');

  /** Values used to prefill the form in edit mode. */
  readonly initialHabit = input<Habit | null>(null);

  readonly saved = output<NewHabit>();
  readonly cancelled = output<void>();

  readonly introTitle = computed(() =>
    this.mode() === 'edit' ? this.t('form.titleEdit') : this.t('form.titleCreate'),
  );

  readonly introSubtitle = computed(() => (this.mode() === 'edit' ? this.t('form.subEdit') : this.t('form.subCreate')));

  readonly submitLabel = computed(() =>
    this.mode() === 'edit' ? this.t('form.submitEdit') : this.t('form.submitCreate'),
  );

  readonly title = signal('');
  readonly inputError = signal(false);

  readonly suggestions = computed<Suggestion[]>(() => [
    { emojiLabel: this.t('suggestion.read'), name: this.t('suggestion.readName'), icon: 'menu_book', color: 'mint' },
    {
      emojiLabel: this.t('suggestion.meditate'),
      name: this.t('suggestion.meditateName'),
      icon: 'self_improvement',
      color: 'mint',
    },
    {
      emojiLabel: this.t('suggestion.run'),
      name: this.t('suggestion.runName'),
      icon: 'directions_bike',
      color: 'blue',
    },
    { emojiLabel: this.t('suggestion.water'), name: this.t('suggestion.waterName'), icon: 'water_drop', color: 'blue' },
  ]);

  readonly iconOptions = computed<{ icon: IconOption; label: string }[]>(() => [
    { icon: 'water_drop', label: this.t('icon.water') },
    { icon: 'menu_book', label: this.t('icon.book') },
    { icon: 'fitness_center', label: this.t('icon.sport') },
    { icon: 'self_improvement', label: this.t('icon.meditate') },
    { icon: 'bedtime', label: this.t('icon.sleep') },
    { icon: 'edit_note', label: this.t('icon.write') },
    { icon: 'park', label: this.t('icon.nature') },
    { icon: 'directions_bike', label: this.t('icon.bike') },
  ]);

  readonly selectedIcon = signal<IconOption>('self_improvement');

  readonly colorOptions: { color: ColorOption; dotClass: string; checkClass: string }[] = [
    { color: 'mint', dotClass: 'color-dot--mint', checkClass: 'color-dot__check--mint' },
    { color: 'blue', dotClass: 'color-dot--blue', checkClass: 'color-dot__check--blue' },
    { color: 'amber', dotClass: 'color-dot--amber', checkClass: 'color-dot__check--amber' },
    { color: 'tertiary', dotClass: 'color-dot--tertiary', checkClass: 'color-dot__check--tertiary' },
    { color: 'surface', dotClass: 'color-dot--surface', checkClass: 'color-dot__check--surface' },
    { color: 'primaryFixed', dotClass: 'color-dot--primary-fixed', checkClass: 'color-dot__check--primary-fixed' },
  ];

  readonly selectedColor = signal<ColorOption>('mint');

  /** Maps a form color choice to the home-page icon chip styling. */
  private readonly iconClassForColor: Record<ColorOption, string> = {
    mint: 'habit-card__icon--mint',
    blue: 'habit-card__icon--blue',
    amber: 'habit-card__icon--amber',
    tertiary: 'habit-card__icon--tertiary',
    surface: 'habit-card__icon--book',
    primaryFixed: 'habit-card__icon--mint',
  };

  /** Short day names used to describe a custom frequency (legacy parsing). */
  private readonly shortDayIndexes: Record<string, number> = {
    lun: 0,
    mar: 1,
    mer: 2,
    jeu: 3,
    ven: 4,
    sam: 5,
    dim: 6,
  };

  private readonly longDayIndexes: Record<string, number> = {
    lundi: 0,
    mardi: 1,
    mercredi: 2,
    jeudi: 3,
    vendredi: 4,
    samedi: 5,
    dimanche: 6,
  };

  readonly frequencies = computed<{ id: FrequencyOption; label: string }[]>(() => [
    { id: 'daily', label: this.t('frequency.daily') },
    { id: 'custom', label: this.t('frequency.custom') },
    { id: 'weekly', label: this.t('frequency.weekly') },
  ]);

  readonly selectedFrequency = signal<FrequencyOption>('daily');

  readonly dayLabels = computed(() =>
    ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun'].map(
      (key) => this.t(key),
    ),
  );
  readonly selectedDays = signal([true, true, true, true, true, true, true]);

  readonly reminderEnabled = signal(true);
  readonly reminderTime = signal('08:30');

  readonly goal = signal(1);
  readonly goalLabel = computed(() =>
    this.goal() === 1 ? this.t('form.goalOnce') : this.t('form.goalTimes', { count: this.goal() }),
  );

  ngOnInit(): void {
    const habit = this.initialHabit();
    if (habit) {
      this.applyHabit(habit);
    }
  }

  applySuggestion(suggestion: Suggestion): void {
    this.title.set(suggestion.name);
    this.selectedIcon.set(suggestion.icon);
    this.selectedColor.set(suggestion.color);
    this.inputError.set(false);
  }

  selectIcon(icon: IconOption): void {
    this.selectedIcon.set(icon);
  }

  iconFill(icon: IconOption): string {
    return this.selectedIcon() === icon ? "'FILL' 1" : "'FILL' 0";
  }

  selectColor(color: ColorOption): void {
    this.selectedColor.set(color);
  }

  selectFrequency(frequency: FrequencyOption): void {
    this.selectedFrequency.set(frequency);
    this.selectedDays.set(this.defaultDays(frequency));
  }

  toggleDay(index: number): void {
    const days = [...this.selectedDays()];
    days[index] = !days[index];
    this.selectedDays.set(days);
  }

  toggleReminder(): void {
    this.reminderEnabled.set(!this.reminderEnabled());
  }

  changeGoal(delta: number): void {
    const next = Math.min(12, Math.max(1, this.goal() + delta));
    this.goal.set(next);
  }

  save(): void {
    const title = this.title().trim();
    if (!title) {
      this.inputError.set(true);
      setTimeout(() => this.inputError.set(false), 1200);
      return;
    }

    this.saved.emit({
      title,
      icon: this.selectedIcon(),
      iconClass: this.iconClassForColor[this.selectedColor()],
      reminderEnabled: this.reminderEnabled(),
      reminderTime: this.reminderTime(),
      detail: this.detailForFrequency(),
      frequency: this.selectedFrequency(),
      days: [...this.selectedDays()],
      goal: this.goal(),
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  /** Fills every control from an existing habit (edit mode). */
  private applyHabit(habit: Habit): void {
    this.title.set(habit.title);
    this.selectedIcon.set(this.isIcon(habit.icon) ? habit.icon : 'self_improvement');
    this.selectedColor.set(this.colorForIconClass(habit.iconClass));
    this.reminderEnabled.set(habit.reminderEnabled ?? Boolean(habit.time));
    this.reminderTime.set(habit.time ?? '08:30');

    const schedule = this.scheduleFor(habit);
    this.selectedFrequency.set(schedule.frequency);
    this.selectedDays.set(schedule.days);
    this.goal.set(schedule.goal);
  }

  private isIcon(value: string): value is IconOption {
    return this.iconOptions().some((option) => option.icon === value);
  }

  private colorForIconClass(iconClass: string): ColorOption {
    if (iconClass.includes('--blue')) {
      return 'blue';
    }
    if (iconClass.includes('--amber')) {
      return 'amber';
    }
    if (iconClass.includes('--tertiary')) {
      return 'tertiary';
    }
    if (iconClass.includes('--book')) {
      return 'surface';
    }
    return 'mint';
  }

  /**
   * Uses the structured values when they exist. Habits created before those
   * fields were stored fall back to parsing their human-readable detail.
   */
  private scheduleFor(habit: Habit): ScheduleValues {
    if (habit.frequency) {
      return {
        frequency: habit.frequency,
        days: habit.days?.length === 7 ? [...habit.days] : this.defaultDays(habit.frequency),
        goal: habit.goal ?? 1,
      };
    }
    return this.parseDetail(habit.detail ?? '');
  }

  private parseDetail(detail: string): ScheduleValues {
    const [schedulePart = '', goalPart = ''] = detail.split('·');
    const goalMatch = goalPart.match(/(\d+)\s*×/);
    const goal = goalMatch ? Number.parseInt(goalMatch[1], 10) : 1;
    const normalized = schedulePart.trim().toLowerCase();

    if (normalized.startsWith('chaque ')) {
      const dayIndex = this.longDayIndexes[normalized.slice(7).trim()];
      if (dayIndex !== undefined) {
        const days = this.emptyDays();
        days[dayIndex] = true;
        return { frequency: 'weekly', days, goal };
      }
    }

    if (normalized.includes(',')) {
      const days = this.emptyDays();
      for (const token of normalized.split(',')) {
        const dayIndex = this.shortDayIndexes[token.trim()];
        if (dayIndex !== undefined) {
          days[dayIndex] = true;
        }
      }
      if (days.some(Boolean)) {
        return { frequency: 'custom', days, goal };
      }
    }

    return { frequency: 'daily', days: this.defaultDays('daily'), goal };
  }

  private defaultDays(frequency: FrequencyOption): boolean[] {
    return frequency === 'weekly'
      ? [true, false, false, false, false, false, false]
      : [true, true, true, true, true, true, true];
  }

  private emptyDays(): boolean[] {
    return [false, false, false, false, false, false, false];
  }

  /** Builds a short human-readable description of the chosen frequency. */
  private detailForFrequency(): string {
    return describeSchedule(this.selectedFrequency(), this.selectedDays(), this.goal(), this.translation.lang());
  }
}
