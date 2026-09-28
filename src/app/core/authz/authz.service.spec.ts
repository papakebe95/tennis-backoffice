import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, beforeEach } from 'vitest';
import { club, grant, profileWith } from '../../../testing/fixtures';
import { SessionStore } from '../auth/session.store';
import { AuthzService } from './authz.service';

describe('AuthzService', () => {
  let authz: AuthzService;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    authz = TestBed.inject(AuthzService);
    session = TestBed.inject(SessionStore);
  });

  it('scopes an organization grant to that organization', () => {
    session.profile.set(
      profileWith([grant({ scope: 'ORGANIZATION', organization: club('a'), permissions: ['court.manage'] })]),
    );
    expect(authz.hasPermission('court.manage', { organizationId: 'a' })).toBe(true);
    expect(authz.hasPermission('court.manage', { organizationId: 'b' })).toBe(false);
    expect(authz.hasPermission('court.manage')).toBe(true); // held somewhere
    expect(authz.hasGlobalPermission('court.manage')).toBe(false);
  });

  it('lets a global grant cover every scope', () => {
    session.profile.set(profileWith([grant({ permissions: ['court.manage'] })]));
    expect(authz.hasPermission('court.manage', { organizationId: 'anything' })).toBe(true);
    expect(authz.hasGlobalPermission('court.manage')).toBe(true);
  });

  it('keeps competition grants inside their competition', () => {
    session.profile.set(
      profileWith([
        grant({ scope: 'COMPETITION', competition: { id: 't1', name: 'Teranga' }, permissions: ['match.result.enter'] }),
      ]),
    );
    expect(authz.hasPermission('match.result.enter', { competitionId: 't1' })).toBe(true);
    expect(authz.hasPermission('match.result.enter', { competitionId: 't2' })).toBe(false);
  });

  it('supports any/all checks and follows grant changes live', () => {
    session.profile.set(profileWith([grant({ permissions: ['user.view'] })]));
    expect(authz.hasAnyPermission(['user.view', 'role.manage'])).toBe(true);
    expect(authz.hasAllPermissions(['user.view', 'role.manage'])).toBe(false);

    session.profile.set(profileWith([])); // permission revoked
    expect(authz.hasPermission('user.view')).toBe(false);
  });

  it('lists each organization once even with several grants in it', () => {
    session.profile.set(
      profileWith([
        grant({ scope: 'ORGANIZATION', organization: club('a'), roleKey: 'CLUB_ADMIN' }),
        grant({ scope: 'ORGANIZATION', organization: club('a'), roleKey: 'COACH' }),
        grant({ scope: 'ORGANIZATION', organization: club('b') }),
      ]),
    );
    expect(authz.organizations().map((o) => o.id)).toEqual(['a', 'b']);
    expect(authz.hasRole('COACH')).toBe(true);
  });
});
