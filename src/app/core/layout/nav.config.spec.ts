import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { SessionStore } from '../auth/session.store';
import { AuthzService } from '../authz/authz.service';
import type { AccessGrant } from '../auth/auth.models';
import type { Workspace } from '../context/workspace.store';
import { club, grant, profileWith } from '../../../testing/fixtures';
import { NAV, visibleNav, type RuleCheck } from './nav.config';

// Runs the real AuthzService rule evaluation, as the shell does.
const checkerFor = (grants: AccessGrant[]): RuleCheck => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  TestBed.inject(SessionStore).profile.set(profileWith(grants));
  const authz = TestBed.inject(AuthzService);
  return (rule, scope) => authz.allows(rule, scope);
};

const ids = (workspace: Workspace | null, grants: AccessGrant[]) =>
  visibleNav(NAV, workspace, checkerFor(grants)).flatMap((s) => s.items.map((i) => i.id));

describe('visibleNav', () => {
  it('shows platform administration to a super admin', () => {
    const items = ids({ kind: 'platform' }, [
      grant({ permissions: ['user.view', 'role.view', 'access_request.review', 'audit.view'] }),
    ]);
    expect(items).toEqual(expect.arrayContaining(['dashboard', 'users', 'roles', 'access-requests', 'audit', 'profile']));
  });

  it('shows club modules only in the club workspace, per permission', () => {
    const clubA = club('a');
    const grants = [grant({ scope: 'ORGANIZATION', organization: clubA, permissions: ['court.view', 'member.view'] })];
    const items = ids({ kind: 'organization', organization: clubA }, grants);
    expect(items).toContain('courts');
    expect(items).toContain('members');
    expect(items).not.toContain('bookings'); // not granted
    expect(items).not.toContain('users'); // platform section hidden
  });

  it("hides another club's modules when switching to a club without grants there", () => {
    const grants = [grant({ scope: 'ORGANIZATION', organization: club('a'), permissions: ['court.view'] })];
    expect(ids({ kind: 'organization', organization: club('b') }, grants)).not.toContain('courts');
  });

  it('drops a menu entry as soon as the permission is gone', () => {
    const workspace: Workspace = { kind: 'platform' };
    expect(ids(workspace, [grant({ permissions: ['user.view'] })])).toContain('users');
    expect(ids(workspace, [grant({ permissions: [] })])).not.toContain('users');
  });

  it('keeps the account section for everyone, even without a workspace', () => {
    expect(ids(null, [])).toEqual(['dashboard', 'notifications', 'profile']);
  });
});
