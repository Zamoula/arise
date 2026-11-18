import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { IonContent } from '@ionic/angular';

import type { Language } from '../i18n/translations';
import { buildAllTimeTotals } from '../models/stats.model';
import { HabitService } from '../services/habit.service';
import { NotificationService } from '../services/notification.service';
import { QuietHoursService } from '../services/quiet-hours.service';
import { ThemeService } from '../services/theme.service';
import type { ThemeChoice } from '../services/theme.service';
import { TranslationService } from '../services/translation.service';
import { AppHeaderComponent } from '../shared/app-header/app-header.component';

export type SoundChoice = 'carillon' | 'drop' | 'silent';

/** Avatar shown until the user picks a photo from his phone. */
const DEFAULT_AVATAR_URL =
  'https://fastly.picsum.photos/id/18/2500/1667.jpg?hmac=JR0Z_jRs9rssQHZJ4b7xKF82kOj8-4Ackq75D_9Wmz8';

/** Key used to persist the chosen avatar across sessions. */
const AVATAR_STORAGE_KEY = 'zen-avatar-url';

/** Picked photos are re-encoded as a square of this size to stay lightweight. */
const AVATAR_SIZE = 512;

@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  imports: [AppHeaderComponent, IonContent, RouterLink],
})
export class ProfilePage {
  private readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);
  private readonly habitService = inject(HabitService);
  private readonly translation = inject(TranslationService);
  private readonly quietHours = inject(QuietHoursService);

  /** Translated string lookup for the template. */
  readonly t = this.translation.t.bind(this.translation);

  /** Overall figures (all-time rate + kind pauses) from the habit history. */
  readonly allTimeStats = computed(() => buildAllTimeTotals(this.habitService.sections()));

  /** Current avatar: the default one or the photo picked from the phone. */
  readonly avatarUrl = signal<string>(DEFAULT_AVATAR_URL);

  constructor() {
    void this.restoreAvatar();
  }

  readonly pressureMode = signal(true);

  /** Mirrors the notification service (persisted switch + OS permission). */
  readonly notifications = this.notificationService.remindersEnabled;

  /** Row subtitle: warns when the OS/browser permission was denied. */
  readonly notificationsSub = computed(() =>
    this.notificationService.permission() === 'denied'
      ? this.t('profile.remindersDenied')
      : this.t('profile.remindersSub'),
  );

  readonly selectedTheme = this.themeService.theme;
  readonly selectedSound = signal<SoundChoice>('carillon');

  /** Quiet-hours window: the profile-page switch, start and end times. */
  readonly quietHoursEnabled = this.quietHours.enabled;
  readonly quietHoursStart = this.quietHours.startTime;
  readonly quietHoursEnd = this.quietHours.endTime;

  /** Row subtitle: explains what the window does, or that it is off. */
  readonly quietHoursSub = computed(() =>
    this.quietHoursEnabled() ? this.t('profile.quietHoursSub') : this.t('profile.quietHoursOffSub'),
  );

  readonly themes = computed<{ id: ThemeChoice; label: string; icon: string }[]>(() => [
    { id: 'warm', label: this.t('theme.warm'), icon: 'light_mode' },
    { id: 'dark', label: this.t('theme.dark'), icon: 'dark_mode' },
    { id: 'auto', label: this.t('theme.auto'), icon: 'hdr_auto' },
  ]);

  readonly sounds = computed<{ id: SoundChoice; label: string; icon: string }[]>(() => [
    { id: 'carillon', label: this.t('sound.carillon'), icon: 'music_note' },
    { id: 'drop', label: this.t('sound.drop'), icon: 'water_drop' },
    { id: 'silent', label: this.t('sound.silent'), icon: 'volume_off' },
  ]);

  /** Language choices (labels stay in their own language). */
  readonly languages = this.translation.languages;

  readonly selectedLanguage = this.translation.lang;

  togglePressureMode(): void {
    this.pressureMode.set(!this.pressureMode());
  }

  toggleNotifications(): void {
    if (this.notifications()) {
      void this.notificationService.disable();
    } else {
      // Asks for the OS permission; the switch stays off when denied.
      void this.notificationService.enable();
    }
  }

  toggleQuietHours(): void {
    void this.quietHours.setEnabled(!this.quietHoursEnabled());
  }

  /** Applies a new quiet-hours start/end time picked in the time inputs. */
  setQuietHoursStart(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      void this.quietHours.setStartTime(value);
    }
  }

  setQuietHoursEnd(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      void this.quietHours.setEndTime(value);
    }
  }

  selectTheme(theme: ThemeChoice): void {
    void this.themeService.setTheme(theme);
  }

  selectSound(sound: SoundChoice): void {
    this.selectedSound.set(sound);
  }

  selectLanguage(language: Language): void {
    void this.translation.setLanguage(language);
  }

  exportStats(): void {
    // Placeholder until the export flow is wired up.
  }

  /**
   * Handles a photo chosen through the hidden file input. On a phone
   * (Capacitor webview) the input opens the native photo picker; the image
   * is resized to a square, shown immediately and persisted.
   */
  async onAvatarPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so picking the same photo again re-triggers the change event.
    input.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    try {
      const dataUrl = await this.readImageAsSquareDataUrl(file);
      this.avatarUrl.set(dataUrl);
      await this.persistAvatar(dataUrl);
    } catch {
      // Photo unreadable: keep the current avatar.
    }
  }

  /** Reads the picked photo and re-encodes it as a centered square data URL. */
  private readImageAsSquareDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const side = Math.min(image.naturalWidth, image.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = AVATAR_SIZE;
          canvas.height = AVATAR_SIZE;
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Canvas unavailable'));
            return;
          }
          // Center-crop the source, then scale it down to AVATAR_SIZE.
          context.drawImage(
            image,
            (image.naturalWidth - side) / 2,
            (image.naturalHeight - side) / 2,
            side,
            side,
            0,
            0,
            AVATAR_SIZE,
            AVATAR_SIZE,
          );
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  /** Restores the previously chosen avatar (falls back to the default one). */
  private async restoreAvatar(): Promise<void> {
    try {
      const stored = (await Preferences.get({ key: AVATAR_STORAGE_KEY })).value;
      if (stored) {
        this.avatarUrl.set(stored);
      }
    } catch {
      // Storage unavailable: the default avatar stays in place.
    }
  }

  private async persistAvatar(dataUrl: string): Promise<void> {
    try {
      await Preferences.set({ key: AVATAR_STORAGE_KEY, value: dataUrl });
    } catch {
      // Storage unavailable: the photo simply won't survive a reload.
    }
  }

  logout(): void {
    // Placeholder until authentication is wired up.
  }
}
