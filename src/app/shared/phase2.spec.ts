import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { profileWith } from '../../testing/fixtures';
import { authGuard, passwordChangeGuard, pendingGuard } from '../core/auth/guards';
import { SessionStore } from '../core/auth/session.store';
import { changeRows } from '../features/admin/audit/audit-log.page';
import { toHttpParams } from './data/list-query';
import { relativeTime } from './format';
import { niceStep } from './ui/bar-chart';

describe('toHttpParams', () => {
  it('sends paging, sort, search and only the filters that are set', () => {
    const params = toHttpParams({
      page: 2,
      pageSize: 50,
      sort: 'createdAt:desc',
      q: 'diop',
      filters: { status: 'ACTIVE', roleKey: undefined },
    });
    expect(params.toString()).toBe('page=2&pageSize=50&sort=createdAt:desc&q=diop&status=ACTIVE');
  });
});

describe('niceStep', () => {
  it('picks clean integer steps for counts', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(3)).toBe(1);
    expect(niceStep(9)).toBe(5);
    expect(niceStep(37)).toBe(10);
    expect(niceStep(1234)).toBe(500);
  });
});

describe('changeRows', () => {
  it('lines up before/after field by field and flags changes', () => {
    expect(changeRows({ status: 'ACTIVE' }, { status: 'SUSPENDED' })).toEqual([
      { field: 'status', before: 'ACTIVE', after: 'SUSPENDED', changed: true },
    ]);
    const rows = changeRows(null, { role: 'CLUB_ADMIN', organizationId: 'org-1' });
    expect(rows.map((r) => [r.field, r.before, r.after])).toEqual([
      ['role', '', 'CLUB_ADMIN'],
      ['organizationId', '', 'org-1'],
    ]);
  });
});

describe('relativeTime', () => {
  it('speaks the UI language', () => {
    const now = Date.parse('2026-09-28T12:00:00Z');
    expect(relativeTime('2026-09-28T09:00:00Z', 'fr', now)).toBe('il y a 3 heures');
    expect(relativeTime('2026-09-27T12:00:00Z', 'en', now)).toBe('yesterday');
  });
});

describe('restricted-session guards', () => {
  const setup = (status: 'ACTIVE' | 'PENDING', mustChangePassword: boolean) => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const profile = profileWith([]);
    TestBed.inject(SessionStore).profile.set({ ...profile, user: { ...profile.user, status, mustChangePassword } });
    const router = TestBed.inject(Router);
    const run = (guard: typeof authGuard) =>
      TestBed.runInInjectionContext(() => guard({} as never, [], {} as never)) as boolean | UrlTree;
    const target = (result: boolean | UrlTree) => (result === true ? true : router.serializeUrl(result as UrlTree));
    return { run, target };
  };

  it('sends an account with a reset password to /change-password first', () => {
    const { run, target } = setup('ACTIVE', true);
    expect(target(run(authGuard))).toBe('/change-password');
    expect(target(run(pendingGuard))).toBe('/change-password');
    expect(target(run(passwordChangeGuard))).toBe(true);
  });

  it('keeps pending accounts on /pending and away from /change-password', () => {
    const { run, target } = setup('PENDING', false);
    expect(target(run(authGuard))).toBe('/pending');
    expect(target(run(passwordChangeGuard))).toBe('/pending');
  });
});
