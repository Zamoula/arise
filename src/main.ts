import { inject, Injector, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { HabitService } from './app/services/habit.service';
import { NotificationService } from './app/services/notification.service';
import { QuietHoursService } from './app/services/quiet-hours.service';
import { ThemeService } from './app/services/theme.service';
import { TranslationService } from './app/services/translation.service';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // Restore persisted state before the first page renders so the app never
    // flashes its default state (light theme, empty habit list).
    provideAppInitializer(async () => {
      // The injection context is only available during the synchronous part
      // of the initializer: capture the injector before the awaits below.
      const injector = inject(Injector);
      // On web the Preferences plugin prefixes keys by default
      // ("CapacitorStorage.<key>"): switch to unprefixed keys so data saved
      // before the @capacitor/preferences migration keeps working. Native
      // platforms ignore this and store values natively.
      if (Capacitor.getPlatform() === 'web') {
        await Preferences.configure({ group: 'NativeStorage' });
      }
      await Promise.all([
        injector.get(ThemeService).ready,
        injector.get(TranslationService).ready,
        injector.get(HabitService).ready,
        injector.get(NotificationService).ready,
        injector.get(QuietHoursService).ready,
      ]);
    }),
  ],
});
