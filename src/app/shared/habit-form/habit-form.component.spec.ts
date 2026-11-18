import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { Habit } from '../../services/habit.service';

import { HabitFormComponent } from './habit-form.component';

const HABIT: Habit = {
  id: 1,
  title: 'Méditation guidée',
  icon: 'self_improvement',
  iconClass: 'habit-card__icon--blue',
  state: 'todo',
  time: '18:30',
  detail: 'Lun, Mer · 2× par jour',
  reminderEnabled: true,
  frequency: 'custom',
  days: [true, false, true, false, false, false, false],
  goal: 2,
};

describe('HabitFormComponent', () => {
  let component: HabitFormComponent;
  let fixture: ComponentFixture<HabitFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HabitFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HabitFormComponent);
    component = fixture.componentInstance;
  });

  it('prefills the form from an existing habit', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialHabit', HABIT);
    fixture.detectChanges();

    expect(component.title()).toBe('Méditation guidée');
    expect(component.selectedIcon()).toBe('self_improvement');
    expect(component.selectedColor()).toBe('blue');
    expect(component.reminderTime()).toBe('18:30');
    expect(component.selectedFrequency()).toBe('custom');
    expect(component.selectedDays()).toEqual([true, false, true, false, false, false, false]);
    expect(component.goal()).toBe(2);
  });

  it('emits the updated values when saving', () => {
    const emitted: unknown[] = [];
    component.saved.subscribe((value) => emitted.push(value));

    fixture.detectChanges();
    component.title.set('Lire 10 pages');
    component.goal.set(3);
    component.save();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      title: 'Lire 10 pages',
      goal: 3,
      frequency: 'daily',
    });
  });
});
