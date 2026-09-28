// Shapes returned by the /admin API (see tennis-backend/src/admin).
import type { OrganizationType, RoleScope, UserStatus } from '../../core/auth/auth.models';

export interface Named {
  id: string;
  name: string;
}

export interface PersonRef {
  id: string;
  firstname: string;
  lastname: string;
}

export interface RoleRef {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
}

export interface UserGrant {
  id: string;
  grantedAt: string;
  revokedAt: string | null;
  role: RoleRef;
  organization: (Named & { type: OrganizationType }) | null;
  competition: Named | null;
}

export interface UserListItem {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  msisdn: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  grants: UserGrant[];
}

export interface UserDetail extends Omit<UserListItem, 'grants' | 'avatarUrl'> {
  passwordChangedAt: string | null;
  mustChangePassword: boolean;
  profile: { avatarUrl: string | null; level: string; city: string | null } | null;
  stats: { bookings: number; matchesRecorded: number };
  grants: (UserGrant & { grantedBy: PersonRef | null; permissions: string[] })[];
}

export interface Role extends RoleRef {
  description: string | null;
  organizationType: OrganizationType | null;
  isSystem: boolean;
  selfRegistrable: boolean;
  permissions: string[];
  activeGrants: number;
}

export interface PermissionEntry {
  key: string;
  module: string;
  description: string;
  scopes: RoleScope[];
  roles: { id: string; key: string; name: string }[];
}

export type AccessRequestStatus = 'PENDING' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ProposedOrganization {
  type: OrganizationType;
  name: string;
  cityId?: string | null;
  countryId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface AccessRequest {
  id: string;
  status: AccessRequestStatus;
  message: string | null;
  proposedOrganization: ProposedOrganization | null;
  infoRequest: string | null;
  infoResponse: string | null;
  decisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: RoleRef & { organizationType: OrganizationType | null };
  organization: (Named & { type: OrganizationType; status: string }) | null;
  reviewer: PersonRef | null;
}

export interface AdminAccessRequest extends AccessRequest {
  user: PersonRef & { email: string; msisdn: string; status: UserStatus; createdAt: string };
}

export interface AccessRequestDetail extends AdminAccessRequest {
  userGrants: Omit<UserGrant, 'grantedAt' | 'revokedAt'>[];
  otherRequests: { id: string; status: AccessRequestStatus; createdAt: string; role: { name: string } }[];
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: PersonRef | null;
  organization: Named | null;
  competition: Named | null;
}

export interface GlobalDashboard {
  generatedAt: string;
  pendingActions: { key: string; count: number; route: string }[];
  users: { total: number; active: number; pending: number; suspended: number; activeLast30Days: number };
  organizations: { federations: number; clubs: number; communities: number };
  tournaments: { total: number; UPCOMING: number; ONGOING: number; COMPLETED: number };
  bookings: { today: number; next7Days: number };
  series: { newUsers: { week: string; count: number }[]; bookingsMade: { week: string; count: number }[] };
  recentActivity: Pick<AuditEntry, 'id' | 'action' | 'entityType' | 'entityId' | 'createdAt' | 'actor'>[];
}
