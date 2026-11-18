import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { TranslationService } from './translation.service';

const STORAGE_KEY = 'zen-language';

describe('TranslationService', () => {
  function resetLanguageState(): void {
    localStorage.clear();
    document.documentElement.lang = 'fr';
  }

  beforeEach(resetLanguageState);
  afterEach(resetLanguageState);

  beforeEach(async () => {
    // Keep the plugin's unprefixed keys (as configured at app startup) so the
    // specs can seed and assert through localStorage directly.
    await Preferences.configure({ group: 'NativeStorage' });
  });

  it('defaults to French', async () => {
    const service = TestBed.inject(TranslationService);
    await service.ready;

    expect(service.lang()).toBe('fr');
    expect(service.locale).toBe('fr-FR');
    expect(service.t('home.hello')).toBe('Bonjour');
  });

  it('switches to English, translates and persists the choice', async () => {
    const service = TestBed.inject(TranslationService);
    await service.ready;

    await service.setLanguage('en');

    expect(service.lang()).toBe('en');
    expect(service.locale).toBe('en-US');
    expect(service.t('home.hello')).toBe('Hello');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
  });

  it('interpolates parameters', async () => {
    const service = TestBed.inject(TranslationService);
    await service.ready;

    expect(service.t('home.progressTitle', { done: 2, total: 5 })).toBe('2 sur 5 accomplies');

    await service.setLanguage('en');

    expect(service.t('home.progressTitle', { done: 2, total: 5 })).toBe('2 of 5 completed');
  });

  it('restores the persisted choice at startup', async () => {
    localStorage.setItem(STORAGE_KEY, 'en');

    const service = TestBed.inject(TranslationService);
    await service.ready;

    expect(service.lang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('falls back to French for unknown persisted values', async () => {
    localStorage.setItem(STORAGE_KEY, 'klingon');

    const service = TestBed.inject(TranslationService);
    await service.ready;

    expect(service.lang()).toBe('fr');
  });

  it('returns the key itself when a translation is missing', async () => {
    const service = TestBed.inject(TranslationService);
    await service.ready;

    expect(service.t('unknown.key')).toBe('unknown.key');
  });
});
