import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { NotificationService } from './services/notification.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  // Injected at bootstrap so the persisted theme is applied to the
  // document before the first page renders.
  private readonly themeService = inject(ThemeService);

  // Prepares the notification channel, the permission state and the
  // tap listener; actual reminders are scheduled by the service itself.
  private readonly notificationService = inject(NotificationService);

  constructor() {
    void this.notificationService.init();
  }
}
