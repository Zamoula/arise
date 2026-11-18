import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Habit, HabitSection } from '../services/habit.service';
import { HabitService } from '../services/habit.service';
import { QuietHoursService } from '../services/quiet-hours.service';
import { ThemeService } from '../services/theme.service';

import { ProfilePage } from './profile.page';

const DARK_CLASS = 'ion-palette-dark';

function makeSection(habits: Habit[]): HabitSection[] {
  return [
    { id: 'morning', label: 'Matin', icon: 'wb_twilight', habits },
    { id: 'afternoon', label: 'Après-midi', icon: 'light_mode', habits: [] },
    { id: 'evening', label: 'Soirée', icon: 'bedtime', habits: [] },
  ];
}

describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);

    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // The persisted quiet-hours window is restored asynchronously.
    await TestBed.inject(QuietHoursService).ready;
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('selecting a theme drives the global ThemeService and the dark palette', () => {
    const themeService = TestBed.inject(ThemeService);

    component.selectTheme('dark');

    expect(component.selectedTheme()).toBe('dark');
    expect(themeService.theme()).toBe('dark');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);

    component.selectTheme('warm');

    expect(themeService.theme()).toBe('warm');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
  });

  it('lets the user choose and toggle the quiet-hours window', async () => {
    expect(component.quietHoursEnabled()).toBe(true);
    expect(component.quietHoursStart()).toBe('22:00');
    expect(component.quietHoursEnd()).toBe('07:00');

    component.toggleQuietHours();
    expect(component.quietHoursEnabled()).toBe(false);

    component.setQuietHoursStart({ target: { value: '21:30' } } as unknown as Event);
    component.setQuietHoursEnd({ target: { value: '06:45' } } as unknown as Event);
    await fixture.whenStable();

    expect(component.quietHoursStart()).toBe('21:30');
    expect(component.quietHoursEnd()).toBe('06:45');
  });

  it('computes the hero stats from the shared habit history', () => {
    const habitService = TestBed.inject(HabitService);
    const today = new Date();
    const iso = (offset: number) => {
      const day = new Date(today);
      day.setDate(day.getDate() + offset);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    };

    habitService.sections.set(
      makeSection([
        {
          id: 1,
          title: 'Méditation',
          icon: 'self_improvement',
          iconClass: 'habit-card__icon--mint',
          state: 'todo',
          frequency: 'daily',
          days: [true, true, true, true, true, true, true],
          completedDates: [iso(0)],
          createdAt: iso(-2),
        },
      ]),
    );

    // Three scheduled days (yesterday, today…) with one completion, and no
    // pause yet since the daily habit covers every elapsed day.
    expect(component.allTimeStats().expected).toBe(3);
    expect(component.allTimeStats().completed).toBe(1);
    expect(component.allTimeStats().completionRate).toBe(33);
    expect(component.allTimeStats().kindPauses).toBe(0);
    // Today is validated, so the streak counts one day.
    expect(component.allTimeStats().currentStreak).toBe(1);
  });
});
