import { Location } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { IonContent } from '@ionic/angular';

import type { NewHabit } from '../services/habit.service';
import { HabitService } from '../services/habit.service';
import { NotificationService } from '../services/notification.service';
import { TranslationService } from '../services/translation.service';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';
import { HabitFormComponent } from '../shared/habit-form/habit-form.component';

@Component({
  selector: 'app-edit-habit',
  templateUrl: 'edit-habit.page.html',
  styleUrls: ['edit-habit.page.scss'],
  imports: [AppHeaderComponent, IonContent, HabitFormComponent],
})
export class EditHabitPage {
  /** Bound from the route parameter via withComponentInputBinding. */
  readonly id = input<string>();

  private readonly location = inject(Location);
  private readonly habitService = inject(HabitService);
  private readonly notificationService = inject(NotificationService);
  private readonly translation = inject(TranslationService);

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);

  readonly habitId = computed(() => {
    const id = Number.parseInt(this.id() ?? '', 10);
    return Number.isNaN(id) ? undefined : id;
  });

  readonly habit = computed(() => {
    const id = this.habitId();
    return id === undefined ? undefined : this.habitService.findHabit(id);
  });

  save(data: NewHabit): void {
    const id = this.habitId();
    if (id === undefined) {
      return;
    }
    this.habitService.updateHabit(id, data);
    if (data.reminderEnabled) {
      // Asks for the OS permission (no-op when already granted).
      void this.notificationService.enable();
    }
    this.location.back();
  }

  goBack(): void {
    this.location.back();
  }
}
