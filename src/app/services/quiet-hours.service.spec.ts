import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { QuietHoursService } from './quiet-hours.service';

/** A date on the current day at the given local time. */
function atTime(hours: number, minutes = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
}

describe('QuietHoursService', () => {
  let service: QuietHoursService;

  beforeEach(async () => {
    localStorage.clear();
    // Keep the plugin's unprefixed keys (as configured at app startup) so the
    // specs can seed and assert through localStorage directly.
    await Preferences.configure({ group: 'NativeStorage' });
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuietHoursService);
    await service.ready;
  });

  it('starts with the default window enabled (22:00 → 07:00)', () => {
    expect(service.enabled()).toBe(true);
    expect(service.startTime()).toBe('22:00');
    expect(service.endTime()).toBe('07:00');
  });

  it('silences the overnight window', () => {
    expect(service.isSilenced(atTime(22, 0))).toBe(true);
    expect(service.isSilenced(atTime(23, 30))).toBe(true);
    expect(service.isSilenced(atTime(0, 30))).toBe(true);
    expect(service.isSilenced(atTime(6, 59))).toBe(true);

    expect(service.isSilenced(atTime(7, 0))).toBe(false);
    expect(service.isSilenced(atTime(12, 0))).toBe(false);
    expect(service.isSilenced(atTime(21, 59))).toBe(false);
  });

  it('silences a same-day window', async () => {
    await service.setStartTime('09:00');
    await service.setEndTime('17:00');

    expect(service.isSilenced(atTime(12, 0))).toBe(true);
    expect(service.isSilenced(atTime(8, 59))).toBe(false);
    expect(service.isSilenced(atTime(17, 0))).toBe(false);
  });

  it('never silences anything while the feature is off', async () => {
    await service.setEnabled(false);

    expect(service.isSilenced(atTime(23, 0))).toBe(false);
  });

  it('treats an empty window (start === end) as no silence', async () => {
    await service.setStartTime('22:00');
    await service.setEndTime('22:00');

    expect(service.isSilenced(atTime(22, 0))).toBe(false);
  });

  it('ignores malformed times', async () => {
    await service.setStartTime('not-a-time');
    await service.setStartTime('25:00');

    expect(service.startTime()).toBe('22:00');
  });

  it('persists the window across sessions', async () => {
    await service.setEnabled(false);
    await service.setStartTime('21:30');
    await service.setEndTime('06:15');

    expect(localStorage.getItem('zen-quiet-hours-enabled')).toBe('false');
    expect(localStorage.getItem('zen-quiet-hours-start')).toBe('21:30');
    expect(localStorage.getItem('zen-quiet-hours-end')).toBe('06:15');

    // A fresh injector mimics a new app session reading storage at startup.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const reloaded = TestBed.inject(QuietHoursService);

    await reloaded.ready;

    expect(reloaded.enabled()).toBe(false);
    expect(reloaded.startTime()).toBe('21:30');
    expect(reloaded.endTime()).toBe('06:15');
  });
});
