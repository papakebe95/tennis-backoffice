import { describe, expect, it } from 'vitest';
import { checkResult, formatScore } from '../features/tournaments/tennis-score';
import { sideName } from '../features/tournaments/tournament.models';
import { formatDate, fromWallClock, wallClockIso } from './format';

const rules = { bestOf: 3, gamesPerSet: 6, finalSet: 'SUPER_TIEBREAK' as const };

describe('score rules (mirror of the API)', () => {
  it('accepts a match won in a match tiebreak', () => {
    const result = checkResult(rules, 'PLAYED', [
      { side1: 6, side2: 2 },
      { side1: 3, side2: 6 },
      { side1: 1, side2: 0, tiebreak1: 10, tiebreak2: 8, superTiebreak: true },
    ]);
    expect(result).toEqual({ ok: true, winnerSide: 1, setsWon: [2, 1] });
  });

  it('asks for tiebreak points at 7-6 and flags unfinished matches', () => {
    expect(checkResult(rules, 'PLAYED', [{ side1: 7, side2: 6 }])).toEqual({ ok: false, errors: [{ code: 'TIEBREAK_REQUIRED', set: 1 }] });
    expect(checkResult(rules, 'PLAYED', [{ side1: 6, side2: 4 }])).toEqual({ ok: false, errors: [{ code: 'MATCH_NOT_FINISHED' }] });
  });

  it('writes the score the usual way', () => {
    expect(formatScore([{ side1: 6, side2: 4 }, { side1: 7, side2: 6, tiebreak1: 7, tiebreak2: 5 }])).toBe('6-4 7-6(5)');
  });
});

describe('tournament wall-clock time (Dakar = UTC)', () => {
  it('sends the time picked as the same time in UTC, and back', () => {
    const picked = new Date(2026, 9, 11, 10, 30);
    expect(wallClockIso(picked)).toBe('2026-10-11T10:30:00.000Z');
    const back = fromWallClock('2026-10-11T10:30:00.000Z');
    expect([back.getHours(), back.getMinutes(), back.getDate()]).toEqual([10, 30, 11]);
  });

  it('shows match times on the tournament clock', () => {
    expect(formatDate('2026-10-11T10:00:00.000Z', 'fr', 'time')).toBe('10:00');
  });
});

describe('sideName', () => {
  it('names a player, or a pair by last names', () => {
    const player = { id: 'u', firstname: 'Babacar', lastname: 'Sy', avatarUrl: null, classification: '15/3' };
    expect(sideName({ id: 'e', seed: 1, entryType: 'DIRECT', player, partner: null })).toBe('Babacar Sy');
    expect(sideName({ id: 'e', seed: null, entryType: 'DIRECT', player, partner: { id: 'p', firstname: 'Ibou', lastname: 'Ndour' } })).toBe('Sy / Ndour');
    expect(sideName(null)).toBe('');
  });
});
