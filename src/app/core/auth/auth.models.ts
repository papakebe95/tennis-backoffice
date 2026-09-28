// Shapes returned by the API's /auth endpoints.

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'REJECTED';
export type RoleScope = 'GLOBAL' | 'ORGANIZATION' | 'COMPETITION';
export type OrganizationType = 'FEDERATION' | 'CLUB' | 'COMMUNITY';

export interface GrantedOrganization {
  id: string;
  name: string;
  type: OrganizationType;
  status: string;
  logoUrl: string | null;
  /** Set when the organization is a club. */
  clubId: string | null;
}

export interface AccessGrant {
  id: string;
  grantedAt: string;
  roleKey: string;
  roleName: string;
  scope: RoleScope;
  organization: GrantedOrganization | null;
  competition: { id: string; name: string } | null;
  permissions: string[];
}

export interface AccessProfile {
  user: {
    id: string;
    email: string;
    firstname: string;
    lastname: string;
    msisdn: string;
    status: UserStatus;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
    /** An administrator reset the password: it must be changed first. */
    mustChangePassword: boolean;
    avatarUrl: string | null;
  };
  grants: AccessGrant[];
}

export interface AccessToken {
  accessToken: string;
}
