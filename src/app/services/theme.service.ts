import { computed, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';

/** Theme choices offered on the profile page. */
export type ThemeChoice = 'warm' | 'dark' | 'auto';

/** Key used to persist the theme choice across sessions. */
const THEME_STORAGE_KEY = 'zen-theme-choice';

/** Ionic dark palette class (see `dark.class.css` in `global.scss`). */
const DARK_PALETTE_CLASS = 'ion-palette-dark';

/** Native status bar backgrounds matching each palette (Android only). */
const LIGHT_STATUS_BAR_COLOR = '#fbfbfa'; // --zen-surface-canvas
const DARK_STATUS_BAR_COLOR = '#000000'; // dark canvas

const THEME_CHOICES: readonly ThemeChoice[] = ['warm', 'dark', 'auto'];

/**
 * Owns the app's visual theme: the user's choice (warm / dark / auto),
 * whether the dark palette is currently active, and applying that state
 * to the document as the `ion-palette-dark` class (plus the native status
 * bar on phones).
 *
 * The choice is persisted with @capacitor/preferences so it survives reloads,
 * and `auto` follows the OS `prefers-color-scheme` live.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Media query mirroring the OS dark preference (null when unsupported). */
  private readonly systemDarkQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  /** Reactive mirror of the OS preference, updated by the change listener. */
  private readonly systemPrefersDark = signal(this.readSystemPreference());

  /** The user's theme choice ("warm" is the Zen light theme). */
  readonly theme = signal<ThemeChoice>('warm');

  /** Resolves once the persisted choice has been read back from storage. */
  readonly ready: Promise<void>;

  /** Whether the dark palette should currently be applied. */
  readonly isDark = computed(() => {
    const choice = this.theme();
    if (choice === 'dark') {
      return true;
    }
    if (choice === 'auto') {
      return this.systemPrefersDark();
    }
    return false;
  });

  constructor() {
    // React to OS-level theme changes while in "auto" mode.
    this.systemDarkQuery?.addEventListener('change', (event) => {
      this.systemPrefersDark.set(event.matches);
      if (this.theme() === 'auto') {
        this.applyTheme();
      }
    });

    // Apply the persisted choice immediately so there is no flash of the
    // wrong theme at startup: the app initializer awaits `ready` before the
    // first page renders.
    this.ready = this.restore();
  }

  async setTheme(choice: ThemeChoice): Promise<void> {
    this.theme.set(choice);
    this.applyTheme();
    await this.persist(choice);
  }

  private applyTheme(): void {
    const dark = this.isDark();
    document.documentElement.classList.toggle(DARK_PALETTE_CLASS, dark);
    void this.syncNativeStatusBar(dark);
  }

  /**
   * Keeps the native status bar in sync with the palette (native platforms
   * only): dark icons over the light canvas, light icons over the black
   * canvas. This is what makes "Automatique" feel native on a phone: the
   * whole chrome, not just the page, follows the OS theme — including live
   * changes while the app is open.
   */
  private async syncNativeStatusBar(dark: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({
          color: dark ? DARK_STATUS_BAR_COLOR : LIGHT_STATUS_BAR_COLOR,
        });
      }
    } catch {
      // Status bar styling is cosmetic: ignore any failure.
    }
  }

  private readSystemPreference(): boolean {
    return this.systemDarkQuery?.matches ?? false;
  }

  /** Restores the persisted choice and applies it (falls back to "warm"). */
  private async restore(): Promise<void> {
    let stored: string | null = null;
    try {
      stored = (await Preferences.get({ key: THEME_STORAGE_KEY })).value;
    } catch {
      // Storage can fail (private mode, unavailable storage…): fall back.
    }
    this.theme.set(THEME_CHOICES.find((choice) => choice === stored) ?? 'warm');
    this.applyTheme();
  }

  private async persist(choice: ThemeChoice): Promise<void> {
    try {
      await Preferences.set({ key: THEME_STORAGE_KEY, value: choice });
    } catch {
      // Storage unavailable: the choice simply won't survive a reload.
    }
  }
}
