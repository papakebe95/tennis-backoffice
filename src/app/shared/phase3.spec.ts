import { describe, expect, it } from 'vitest';
import { weekToWindows, windowsToWeek } from '../features/organizations/courts.page';
import { dayValid, emptyWeek, hoursValid } from './forms/opening-hours-editor';

describe('opening hours validation (mirrors the API)', () => {
  it('accepts ordered, non-overlapping windows', () => {
    expect(dayValid(['07:00-12:00', '14:00-22:00'])).toBe(true);
    expect(dayValid([])).toBe(true); // closed
  });

  it('rejects inverted, overlapping or malformed windows', () => {
    expect(dayValid(['22:00-07:00'])).toBe(false);
    expect(dayValid(['07:00-13:00', '12:00-20:00'])).toBe(false);
    expect(dayValid(['7:00-12:00'])).toBe(false);
  });

  it('checks every day of the week', () => {
    const week = { ...emptyWeek(), sat: ['10:00-09:00'] };
    expect(hoursValid(emptyWeek())).toBe(true);
    expect(hoursValid(week)).toBe(false);
  });
});

describe('court availability ⇄ weekly editor', () => {
  it('round-trips (weekday 0 = Monday)', () => {
    const windows = [
      { weekday: 0, opensAt: '17:00', closesAt: '23:00' },
      { weekday: 6, opensAt: '08:00', closesAt: '12:00' },
      { weekday: 6, opensAt: '14:00', closesAt: '20:00' },
    ];
    const week = windowsToWeek(windows);
    expect(week.mon).toEqual(['17:00-23:00']);
    expect(week.sun).toEqual(['08:00-12:00', '14:00-20:00']);
    expect(week.tue).toEqual([]);
    expect(weekToWindows(week)).toEqual(windows);
  });
});
