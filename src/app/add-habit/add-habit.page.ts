import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { IonContent } from '@ionic/angular';

import type { NewHabit } from '../services/habit.service';
import { HabitService } from '../services/habit.service';
import { NotificationService } from '../services/notification.service';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';
import { HabitFormComponent } from '../shared/habit-form/habit-form.component';

@Component({
  selector: 'app-add-habit',
  templateUrl: 'add-habit.page.html',
  styleUrls: ['add-habit.page.scss'],
  imports: [AppHeaderComponent, IonContent, HabitFormComponent],
})
export class AddHabitPage {
  private readonly location = inject(Location);
  private readonly habitService = inject(HabitService);
  private readonly notificationService = inject(NotificationService);

  save(habit: NewHabit): void {
    this.habitService.addHabit(habit);
    if (habit.reminderEnabled) {
      // Asks for the OS permission (no-op when already granted).
      void this.notificationService.enable();
    }
    this.location.back();
  }

  goBack(): void {
    this.location.back();
  }
}
