// Builders for authorization test data.
import type { AccessGrant, AccessProfile } from '../app/core/auth/auth.models';

export const grant = (overrides: Partial<AccessGrant>): AccessGrant => ({
  id: Math.random().toString(36),
  grantedAt: '2026-09-28T00:00:00Z',
  roleKey: 'ROLE',
  roleName: 'Role',
  scope: 'GLOBAL',
  organization: null,
  competition: null,
  permissions: [],
  ...overrides,
});

export const club = (id: string, name = id) => ({
  id,
  name,
  type: 'CLUB' as const,
  status: 'ACTIVE',
  logoUrl: null,
  clubId: `club-${id}`,
});

export const profileWith = (grants: AccessGrant[]): AccessProfile => ({
  user: {
    id: 'u1',
    email: 'u@x.dev',
    firstname: 'Awa',
    lastname: 'Sarr',
    msisdn: '+221770000001',
    status: 'ACTIVE',
    lastLoginAt: null,
    passwordChangedAt: null,
    mustChangePassword: false,
    avatarUrl: null,
  },
  grants,
});
