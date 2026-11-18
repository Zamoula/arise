import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { toIsoDate } from '../models/date.model';

export type Moment = 'morning' | 'afternoon' | 'evening';

export type HabitState = 'done' | 'todo' | 'postponed';

export type Frequency = 'daily' | 'custom' | 'weekly';

export interface Habit {
  id: number;
  title: string;
  icon: string;
  iconClass: string;
  state: HabitState;
  time?: string;
  detail?: string;
  detailTone?: 'primary' | 'muted';
  doneNote?: string;
  /** Structured form values, kept so the edit page can prefill exactly. */
  reminderEnabled?: boolean;
  frequency?: Frequency;
  days?: boolean[];
  goal?: number;
  /** ISO dates (`YYYY-MM-DD`) on which the habit was completed. */
  completedDates?: string[];
  /** ISO date the habit was created, so stats ignore days before it existed. */
  createdAt?: string;
}

export interface HabitSection {
  id: Moment;
  label: string;
  icon: string;
  habits: Habit[];
}

/** Key used to persist the habits across sessions. */
const HABITS_STORAGE_KEY = 'zen-habits-v1';

/** Default empty habit sections shown when no habits have been created yet. */
const HABIT_SECTIONS: HabitSection[] = [
  {
    id: 'morning',
    label: 'Matin',
    icon: 'wb_twilight',
    habits: [],
  },
  {
    id: 'afternoon',
    label: 'Après-midi',
    icon: 'light_mode',
    habits: [],
  },
  {
    id: 'evening',
    label: 'Soirée',
    icon: 'bedtime',
    habits: [],
  },
];

/** Data gathered from the add/edit habit form (everything is optional except the title). */
export interface NewHabit {
  title: string;
  icon: string;
  iconClass: string;
  reminderEnabled: boolean;
  reminderTime: string;
  detail?: string;
  frequency: Frequency;
  days: boolean[];
  goal: number;
}

/**
 * Owns the list of habits, grouped by moment of the day (morning /
 * afternoon / evening). The list is persisted with @capacitor/preferences so
 * newly created habits survive reloads on web and mobile.
 */
@Injectable({ providedIn: 'root' })
export class HabitService {
  /** All habit sections, restored from storage or empty by default. */
  readonly sections = signal<HabitSection[]>(HABIT_SECTIONS);

  /** Resolves once the persisted sections have been read back from storage. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restore();
  }

  /**
   * Restores the persisted sections, then re-aligns the daily states and
   * persists the normalized history so legacy "done" habits are migrated once.
   */
  private async restore(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: HABITS_STORAGE_KEY });
      if (value) {
        const parsed: unknown = JSON.parse(value);
        if (isSectionList(parsed)) {
          this.sections.set(normalizeSections(parsed));
        }
      }
    } catch {
      // Storage can fail (corrupted data, unavailable storage…): fall back.
    }
    // A habit marked "done" yesterday becomes "todo" again today.
    this.refreshDailyStates();
    await this.persist();
  }

  /** Creates a habit from the add-habit form and places it in a section. */
  addHabit(data: NewHabit): void {
    const habit: Habit = {
      id: this.nextId(),
      title: data.title,
      icon: data.icon,
      iconClass: data.iconClass,
      state: 'todo',
      time: data.reminderEnabled ? data.reminderTime : undefined,
      detail: data.detail,
      detailTone: data.detail ? 'muted' : undefined,
      reminderEnabled: data.reminderEnabled,
      frequency: data.frequency,
      days: [...data.days],
      goal: data.goal,
      completedDates: [],
      createdAt: toIsoDate(new Date()),
    };

    const sectionId = this.momentFor(data.reminderEnabled ? data.reminderTime : '');
    this.sections.update((sections) =>
      sections.map((section) =>
        section.id === sectionId ? { ...section, habits: [...section.habits, habit] } : section,
      ),
    );
    void this.persist();
  }

  /** Finds a habit by id across every section. */
  findHabit(id: number): Habit | undefined {
    for (const section of this.sections()) {
      const habit = section.habits.find((item) => item.id === id);
      if (habit) {
        return habit;
      }
    }
    return undefined;
  }

  /**
   * Updates a habit from the edit form. The habit keeps its completion state
   * (and its place in the list) and moves to another moment section when its
   * reminder time changes.
   */
  updateHabit(id: number, data: NewHabit): void {
    const habit = this.findHabit(id);
    if (!habit) {
      return;
    }

    const updated: Habit = {
      ...habit,
      title: data.title,
      icon: data.icon,
      iconClass: data.iconClass,
      time: data.reminderEnabled ? data.reminderTime : undefined,
      detail: data.detail,
      detailTone: data.detail ? 'muted' : undefined,
      reminderEnabled: data.reminderEnabled,
      frequency: data.frequency,
      days: [...data.days],
      goal: data.goal,
    };

    const currentSection = this.sectionOf(id);
    const targetSection = data.reminderEnabled ? this.momentFor(data.reminderTime) : (currentSection ?? 'morning');
    this.moveHabit(id, updated, currentSection, targetSection);
    void this.persist();
  }

  /**
   * Updates only the reminder schedule of a habit (detail page "Ajuster
   * l'heure"). Everything else — title, icon, completion history — is kept,
   * and the habit moves to another moment section when the time changes.
   */
  updateHabitSchedule(id: number, reminderEnabled: boolean, reminderTime: string): void {
    const habit = this.findHabit(id);
    if (!habit) {
      return;
    }

    const updated: Habit = {
      ...habit,
      time: reminderEnabled ? reminderTime : undefined,
      reminderEnabled,
    };

    const currentSection = this.sectionOf(id);
    const targetSection = reminderEnabled ? this.momentFor(reminderTime) : (currentSection ?? 'morning');
    this.moveHabit(id, updated, currentSection, targetSection);
    void this.persist();
  }

  /** Toggles a habit between "todo" and "done" (home page card tap). */
  toggle(id: number): void {
    const today = toIsoDate(new Date());
    this.sections.update((sections) =>
      sections.map((section) => ({
        ...section,
        habits: section.habits.map((habit) => {
          if (habit.id !== id) {
            return habit;
          }

          const completedDates = new Set(habit.completedDates ?? []);
          let state: HabitState;
          if (habit.state === 'done') {
            state = 'todo';
            completedDates.delete(today);
          } else {
            state = 'done';
            completedDates.add(today);
          }

          return {
            ...habit,
            state,
            completedDates: [...completedDates].sort(),
            doneNote: state === 'done' && !habit.doneNote ? 'Validé' : habit.doneNote,
          };
        }),
      })),
    );
    void this.persist();
  }

  /**
   * Re-aligns every habit's state with today's completion history. Called at
   * startup so a habit completed yesterday no longer looks done today.
   */
  refreshDailyStates(): void {
    const today = toIsoDate(new Date());
    let changed = false;

    const sections = this.sections().map((section) => ({
      ...section,
      habits: section.habits.map((habit) => {
        const state: HabitState = habit.completedDates?.includes(today) ? 'done' : 'todo';
        if (state === habit.state) {
          return habit;
        }
        changed = true;
        return { ...habit, state };
      }),
    }));

    if (changed) {
      this.sections.set(sections);
      void this.persist();
    }
  }

  /** Returns the section currently holding the habit, if any. */
  private sectionOf(id: number): Moment | undefined {
    return this.sections().find((section) => section.habits.some((habit) => habit.id === id))?.id;
  }

  /**
   * Replaces a habit with its updated version, moving it to `targetSection`
   * when it differs from its current section.
   */
  private moveHabit(id: number, updated: Habit, currentSection: Moment | undefined, targetSection: Moment): void {
    this.sections.update((sections) =>
      sections.map((section) => {
        if (section.id === currentSection && section.id === targetSection) {
          return {
            ...section,
            habits: section.habits.map((item) => (item.id === id ? updated : item)),
          };
        }
        if (section.id === currentSection) {
          return {
            ...section,
            habits: section.habits.filter((item) => item.id !== id),
          };
        }
        if (section.id === targetSection) {
          return { ...section, habits: [...section.habits, updated] };
        }
        return section;
      }),
    );
  }

  /**
   * Picks the moment of the day a new habit belongs to, from its reminder
   * time (before noon → morning, before 6pm → afternoon, otherwise evening).
   */
  private momentFor(reminderTime: string): Moment {
    const hour = Number.parseInt(reminderTime.slice(0, 2), 10);
    if (Number.isNaN(hour) || hour < 12) {
      return 'morning';
    }
    return hour < 18 ? 'afternoon' : 'evening';
  }

  private nextId(): number {
    return (
      this.sections().reduce((max, section) => {
        return Math.max(max, ...section.habits.map((habit) => habit.id));
      }, 0) + 1
    );
  }

  private async persist(): Promise<void> {
    try {
      await Preferences.set({ key: HABITS_STORAGE_KEY, value: JSON.stringify(this.sections()) });
    } catch {
      // Storage unavailable: the habits simply won't survive a reload.
    }
  }
}

/** Minimal runtime validation of data read back from storage. */
function isSectionList(value: unknown): value is HabitSection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (section) =>
        typeof section === 'object' &&
        section !== null &&
        'id' in section &&
        'habits' in section &&
        Array.isArray((section as HabitSection).habits),
    )
  );
}

/** Adds the history fields to habits stored before stats existed. */
function normalizeSections(sections: HabitSection[]): HabitSection[] {
  const today = toIsoDate(new Date());
  return sections.map((section) => ({
    ...section,
    habits: section.habits.map((habit) => ({
      ...habit,
      completedDates: normalizeCompletedDates(habit, today),
    })),
  }));
}

function normalizeCompletedDates(habit: Habit, today: string): string[] {
  const stored = Array.isArray(habit.completedDates)
    ? habit.completedDates.filter(
        (date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
      )
    : [];

  if (stored.length === 0 && habit.state === 'done') {
    // The completion date was not tracked yet: today is the safest guess.
    return [today];
  }

  return [...new Set(stored)].sort();
}
