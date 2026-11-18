import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { LANGUAGE_LOCALES, LANGUAGES, TRANSLATIONS } from '../i18n/translations';
import type { Language, TranslationParams } from '../i18n/translations';

/** Key used to persist the language choice across sessions. */
const LANGUAGE_STORAGE_KEY = 'zen-language';

const LANGUAGE_CHOICES: readonly Language[] = ['fr', 'en'];

/**
 * Owns the app's language: the user's choice (français / English), the
 * matching `Intl` locale and every translated string through `t()`.
 *
 * The choice is persisted with @capacitor/preferences so it survives reloads,
 * and `t()` reads the reactive `lang` signal, so any template or computed
 * that calls it re-renders automatically when the language changes.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  /** Choices shown in the profile-page language selector. */
  readonly languages = LANGUAGES;

  /** The user's language (French is the original language of the app). */
  readonly lang = signal<Language>('fr');

  /** Resolves once the persisted choice has been read back from storage. */
  readonly ready: Promise<void>;

  /** Locale passed to `Intl` formatters (derived from the language). */
  get locale(): string {
    return LANGUAGE_LOCALES[this.lang()];
  }

  constructor() {
    // Apply the persisted choice immediately so there is no flash of the
    // wrong language at startup: the app initializer awaits `ready` before
    // the first page renders.
    this.ready = this.restore();
  }

  /**
   * Translates `key` in the current language, interpolating `{name}`
   * placeholders from `params`. Falls back to French, then to the raw key,
   * so a missing translation can never crash the UI.
   */
  t(key: string, params?: TranslationParams): string {
    const dictionary = TRANSLATIONS[this.lang()] ?? TRANSLATIONS.fr;
    let text = dictionary[key] ?? TRANSLATIONS.fr[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
      }
    }
    return text;
  }

  /** Switches the language, updates the document and persists the choice. */
  async setLanguage(language: Language): Promise<void> {
    this.lang.set(language);
    this.applyLanguage();
    await this.persist(language);
  }

  /** Keeps the `<html lang>` attribute in sync for accessibility. */
  private applyLanguage(): void {
    document.documentElement.lang = this.lang();
  }

  /** Restores the persisted choice and applies it (falls back to French). */
  private async restore(): Promise<void> {
    let stored: string | null = null;
    try {
      stored = (await Preferences.get({ key: LANGUAGE_STORAGE_KEY })).value;
    } catch {
      // Storage can fail (private mode, unavailable storage…): fall back.
    }
    this.lang.set(LANGUAGE_CHOICES.find((choice) => choice === stored) ?? 'fr');
    this.applyLanguage();
  }

  private async persist(language: Language): Promise<void> {
    try {
      await Preferences.set({ key: LANGUAGE_STORAGE_KEY, value: language });
    } catch {
      // Storage unavailable: the choice simply won't survive a reload.
    }
  }
}
