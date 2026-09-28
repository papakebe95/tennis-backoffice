import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS, type Page } from '../../core/api/api';
import type { OrganizationType, RoleScope } from '../../core/auth/auth.models';
import { toHttpParams, type ListQuery } from '../../shared/data/list-query';
import type {
  AccessRequestDetail,
  AdminAccessRequest,
  AccessRequestStatus,
  AuditEntry,
  GlobalDashboard,
  Named,
  PermissionEntry,
  Role,
  UserDetail,
  UserGrant,
  UserListItem,
} from './admin.models';

// Calls whose failures the screen shows in place (forms, dialogs) instead of
// as a toast.
const inPlace = { context: new HttpContext().set(SILENT_ERRORS, true) };

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private get<T>(path: string, params?: HttpParams) {
    return firstValueFrom(this.http.get<T>(apiUrl(path), { params }));
  }

  // Users
  users(query: ListQuery) {
    return this.get<Page<UserListItem>>('/admin/users', toHttpParams(query));
  }
  user(id: string) {
    return this.get<UserDetail>(`/admin/users/${id}`);
  }
  setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED', reason?: string) {
    return firstValueFrom(this.http.patch<UserDetail>(apiUrl(`/admin/users/${id}/status`), { status, reason }));
  }
  resetPassword(id: string) {
    return firstValueFrom(this.http.post<{ temporaryPassword: string }>(apiUrl(`/admin/users/${id}/reset-password`), {}));
  }
  grantRole(userId: string, body: { roleId: string; organizationId?: string; competitionId?: string }) {
    return firstValueFrom(this.http.post<UserGrant>(apiUrl(`/admin/users/${userId}/roles`), body, inPlace));
  }
  revokeRole(userId: string, grantId: string, reason?: string) {
    return firstValueFrom(this.http.delete<void>(apiUrl(`/admin/users/${userId}/roles/${grantId}`), { body: { reason } }));
  }

  // Roles
  roles() {
    return this.get<Role[]>('/admin/roles');
  }
  permissions() {
    return this.get<PermissionEntry[]>('/admin/permissions');
  }
  createRole(body: {
    key: string;
    name: string;
    description?: string;
    scope: RoleScope;
    organizationType?: OrganizationType;
    selfRegistrable?: boolean;
    permissions: string[];
  }) {
    return firstValueFrom(this.http.post<Role>(apiUrl('/admin/roles'), body, inPlace));
  }
  updateRole(id: string, body: Partial<Pick<Role, 'name' | 'description' | 'selfRegistrable' | 'scope' | 'organizationType'>>) {
    return firstValueFrom(this.http.patch<Role>(apiUrl(`/admin/roles/${id}`), body));
  }
  setRolePermissions(id: string, permissions: string[]) {
    return firstValueFrom(this.http.put<Role>(apiUrl(`/admin/roles/${id}/permissions`), { permissions }));
  }
  deleteRole(id: string) {
    return firstValueFrom(this.http.delete<void>(apiUrl(`/admin/roles/${id}`)));
  }

  // Access requests
  accessRequests(query: ListQuery) {
    return this.get<Page<AdminAccessRequest> & { counts: Partial<Record<AccessRequestStatus, number>> }>(
      '/admin/access-requests',
      toHttpParams(query),
    );
  }
  accessRequest(id: string) {
    return this.get<AccessRequestDetail>(`/admin/access-requests/${id}`);
  }
  approveRequest(id: string, reason?: string) {
    return firstValueFrom(this.http.post<AccessRequestDetail>(apiUrl(`/admin/access-requests/${id}/approve`), { reason }));
  }
  rejectRequest(id: string, reason?: string) {
    return firstValueFrom(this.http.post<AccessRequestDetail>(apiUrl(`/admin/access-requests/${id}/reject`), { reason }));
  }
  requestInfo(id: string, message: string) {
    return firstValueFrom(this.http.post<AccessRequestDetail>(apiUrl(`/admin/access-requests/${id}/request-info`), { message }));
  }

  // Dashboard & audit
  dashboard() {
    return this.get<GlobalDashboard>('/admin/dashboard');
  }
  auditLogs(query: ListQuery) {
    return this.get<Page<AuditEntry>>('/admin/audit-logs', toHttpParams(query));
  }
  auditFacets() {
    return this.get<{ actions: string[]; entityTypes: string[] }>('/admin/audit-logs/facets');
  }

  // Pickers
  lookupOrganizations(q: string, type?: OrganizationType) {
    let params = new HttpParams().set('q', q);
    if (type) params = params.set('type', type);
    return this.get<(Named & { type: OrganizationType; status: string })[]>('/admin/lookups/organizations', params);
  }
  lookupCompetitions(q: string) {
    return this.get<(Named & { startDate: string; club: { name: string } | null })[]>(
      '/admin/lookups/competitions',
      new HttpParams().set('q', q),
    );
  }
}
