import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/** Default silence window: from 22:00 to 07:00. */
export const DEFAULT_QUIET_START = '22:00';
export const DEFAULT_QUIET_END = '07:00';

/** Keys used to persist the quiet-hours choice across sessions. */
const ENABLED_STORAGE_KEY = 'zen-quiet-hours-enabled';
const START_STORAGE_KEY = 'zen-quiet-hours-start';
const END_STORAGE_KEY = 'zen-quiet-hours-end';

/**
 * Owns the profile-page "Quiet hours (silence)" window: whether it is active,
 * when it starts and when it ends.
 *
 * The window may cross midnight (the default 22:00 → 07:00 does), so the
 * silence check compares minutes-of-the-day instead of raw dates. Reminders
 * falling inside the window are simply not scheduled while it is active.
 */
@Injectable({ providedIn: 'root' })
export class QuietHoursService {
  /** Whether reminders are silenced during the window. */
  readonly enabled = signal(true);

  /** Start of the silence window as `HH:mm`. */
  readonly startTime = signal(DEFAULT_QUIET_START);

  /** End of the silence window as `HH:mm`. */
  readonly endTime = signal(DEFAULT_QUIET_END);

  /** Whether the persisted values have been read back from storage. */
  readonly restored = signal(false);

  /** Resolves once the persisted values have been read back from storage. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restore();
  }

  /** Turns the silence window on or off and persists the choice. */
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled.set(enabled);
    await this.persist(ENABLED_STORAGE_KEY, String(enabled));
  }

  /** Updates the start of the window (ignores malformed values). */
  async setStartTime(value: string): Promise<void> {
    const normalized = normalizeTime(value);
    if (!normalized) {
      return;
    }
    this.startTime.set(normalized);
    await this.persist(START_STORAGE_KEY, normalized);
  }

  /** Updates the end of the window (ignores malformed values). */
  async setEndTime(value: string): Promise<void> {
    const normalized = normalizeTime(value);
    if (!normalized) {
      return;
    }
    this.endTime.set(normalized);
    await this.persist(END_STORAGE_KEY, normalized);
  }

  /**
   * Whether a reminder firing at `when` falls inside the silence window.
   * Returns false while the feature is off or when start and end are equal
   * (an empty window).
   */
  isSilenced(when: Date): boolean {
    if (!this.enabled()) {
      return false;
    }
    const start = parseTime(this.startTime());
    const end = parseTime(this.endTime());
    if (!start || !end || start === end) {
      return false;
    }
    const minutes = when.getHours() * 60 + when.getMinutes();
    if (start < end) {
      return minutes >= start && minutes < end;
    }
    // The window crosses midnight: it covers the end of the day and the
    // beginning of the next one.
    return minutes >= start || minutes < end;
  }

  /** Restores the persisted window (defaults: enabled, 22:00 → 07:00). */
  private async restore(): Promise<void> {
    try {
      const [enabled, start, end] = await Promise.all([
        Preferences.get({ key: ENABLED_STORAGE_KEY }),
        Preferences.get({ key: START_STORAGE_KEY }),
        Preferences.get({ key: END_STORAGE_KEY }),
      ]);
      this.enabled.set(enabled.value !== 'false');
      this.startTime.set(normalizeTime(start.value ?? '') ?? DEFAULT_QUIET_START);
      this.endTime.set(normalizeTime(end.value ?? '') ?? DEFAULT_QUIET_END);
    } catch {
      // Storage unavailable: keep the defaults.
    }
    this.restored.set(true);
  }

  private async persist(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
      // Storage unavailable: the choice simply won't survive a reload.
    }
  }
}

/** Parses an `HH:mm` value into minutes since midnight. */
function parseTime(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return undefined;
  }
  return hours * 60 + minutes;
}

/** Normalizes a time value to the `HH:mm` shape used by `<input type="time">`. */
function normalizeTime(value: string): string | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return undefined;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
