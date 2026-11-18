import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { ThemeService } from './theme.service';

const DARK_CLASS = 'ion-palette-dark';
const STORAGE_KEY = 'zen-theme-choice';

describe('ThemeService', () => {
  function resetThemeState(): void {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
  }

  beforeEach(resetThemeState);
  afterEach(resetThemeState);

  beforeEach(async () => {
    // Keep the plugin's unprefixed keys (as configured at app startup) so the
    // specs can seed and assert through localStorage directly.
    await Preferences.configure({ group: 'NativeStorage' });
  });

  it('defaults to the warm theme and keeps the dark palette off', async () => {
    const service = TestBed.inject(ThemeService);
    await service.ready;

    expect(service.theme()).toBe('warm');
    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
  });

  it('applies the dark palette and persists the dark choice', async () => {
    const service = TestBed.inject(ThemeService);
    await service.ready;

    await service.setTheme('dark');

    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('removes the dark palette when switching back to warm', async () => {
    const service = TestBed.inject(ThemeService);
    await service.ready;
    await service.setTheme('dark');

    await service.setTheme('warm');

    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('warm');
  });

  it('restores the persisted choice at startup', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');

    const service = TestBed.inject(ThemeService);
    await service.ready;

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
  });

  it('falls back to warm for unknown persisted values', async () => {
    localStorage.setItem(STORAGE_KEY, 'neon-pink');

    const service = TestBed.inject(ThemeService);
    await service.ready;

    expect(service.theme()).toBe('warm');
  });

  it('follows the OS preference live in auto mode', async () => {
    const listenerCapture: {
      systemListener: ((event: { matches: boolean }) => void) | null;
    } = { systemListener: null };
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        listenerCapture.systemListener = listener;
      },
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      localStorage.setItem(STORAGE_KEY, 'auto');
      const service = TestBed.inject(ThemeService);
      await service.ready;

      // jsdom reports a light system preference.
      expect(service.isDark()).toBe(false);
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);

      listenerCapture.systemListener?.({ matches: true });

      expect(service.isDark()).toBe(true);
      expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
