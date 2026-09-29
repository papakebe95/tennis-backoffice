import { describe, expect, it } from 'vitest';
import { NAV } from '../core/layout/nav.config';
import { classificationGroups } from '../features/tournaments/event-form';
import { DECISIONS_FROM, entriesOpen, type TournamentEvent } from '../features/tournaments/tournament.models';
import { tableChains } from '../features/tournaments/tournament-overview';
import {
  dayIso,
  emptyTournamentForm,
  toTournamentInput,
  tournamentFormErrors,
} from '../features/tournaments/tournament-fields';

const event = (id: string, qualifiesIntoEventId: string | null = null, tableOrder = 0) =>
  ({ id, name: id, qualifiesIntoEventId, qualifierCount: qualifiesIntoEventId ? 2 : 0, tableOrder }) as TournamentEvent;

describe('tableChains', () => {
  it('lays successive tables out lowest first, one chain per path', () => {
    const chains = tableChains([event('final', null, 2), event('15s', 'final', 1), event('30s', '15s', 0), event('ladies', null, 3)]);
    expect(chains.map((c) => c.map((e) => e.id))).toEqual([['30s', '15s', 'final'], ['ladies']]);
  });

  it('shows a table fed by two lower tables once', () => {
    const chains = tableChains([event('a', 'final'), event('b', 'final'), event('final')]);
    expect(chains.flat().filter((e) => e.id === 'final')).toHaveLength(1);
  });

  it('never loops on inconsistent data', () => {
    const chains = tableChains([event('a', 'b'), event('b', 'a')]);
    expect(chains.flat().map((e) => e.id).sort()).toEqual(['a', 'b']);
  });
});

describe('tournament form', () => {
  it('sends picked days as Dakar (UTC) dates, closing ones at the end of the day', () => {
    const day = new Date(2026, 9, 11);
    expect(dayIso(day)).toBe('2026-10-11T00:00:00Z');
    expect(dayIso(day, true)).toBe('2026-10-11T23:59:00Z');
  });

  it('turns blanks into nulls', () => {
    const input = toTournamentInput({ ...emptyTournamentForm(), name: '  Open  ', startDate: new Date(2026, 9, 11), endDate: new Date(2026, 9, 12) });
    expect(input).toMatchObject({ name: 'Open', location: null, category: null, registrationClosesAt: null, endDate: '2026-10-12T23:59:00Z' });
  });

  it('rejects a short name and inconsistent dates', () => {
    const form = { ...emptyTournamentForm(), name: 'Open ASAC', startDate: new Date(2026, 9, 11), endDate: new Date(2026, 9, 12) };
    expect(tournamentFormErrors(form)).toEqual([]);
    expect(tournamentFormErrors({ ...form, name: 'ab' })).toContain('tournaments.form.name');
    expect(tournamentFormErrors({ ...form, endDate: new Date(2026, 9, 10) })).toContain('tournaments.lifecycle.blockers.INVALID_DATES');
    expect(tournamentFormErrors({ ...form, registrationClosesAt: new Date(2026, 9, 20) })).toContain(
      'tournaments.lifecycle.blockers.INVALID_DATES',
    );
  });
});

describe('registration rules mirrored from the API', () => {
  it('offers only the decisions valid from each status', () => {
    expect(DECISIONS_FROM.approve).toEqual(['PENDING', 'WAITLISTED']);
    expect(DECISIONS_FROM.withdraw).not.toContain('REJECTED');
  });

  it('freezes entries once play starts', () => {
    expect(entriesOpen('REGISTRATION_CLOSED')).toBe(true);
    expect(entriesOpen('IN_PROGRESS')).toBe(false);
    expect(entriesOpen('INTERRUPTED')).toBe(false);
  });
});

describe('classificationGroups', () => {
  it('groups the scale by series in order', () => {
    const t = ((key: string) => key) as never;
    const groups = classificationGroups(
      [
        { id: '1', code: '15', label: '15', rank: 11, series: 'S3' },
        { id: '2', code: '15/1', label: '15/1', rank: 12, series: 'S4' },
        { id: '3', code: 'NC', label: 'Non classé', rank: 24, series: 'NC' },
      ],
      t,
    );
    expect(groups.map((g) => g.label)).toEqual(['classificationSeries.S3', 'classificationSeries.S4', 'classificationSeries.NC']);
    expect(groups[2].items[0].label).toBe('NC · Non classé');
  });
});

describe('tournament navigation', () => {
  it('links the tournament menus of every workspace', () => {
    const items = NAV.flatMap((s) => s.items);
    for (const id of ['tournaments', 'federation-tournaments', 'club-tournaments', 'community-tournaments']) {
      expect(items.find((i) => i.id === id)?.link?.(null)).toEqual(['/tournaments']);
    }
    const workspace = { kind: 'competition', competition: { id: 'c1', name: 'Open' } } as const;
    expect(items.find((i) => i.id === 'competition-registrations')?.link?.(workspace)).toEqual(['/tournaments', 'c1', 'registrations']);
  });
});
