import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS } from '../../core/api/api';
import type { AccessToken, OrganizationType, RoleScope } from '../../core/auth/auth.models';
import type { AccessRequest, ProposedOrganization } from '../admin/admin.models';

export interface RegistrationOptions {
  roles: { key: string; name: string; description: string | null; scope: RoleScope; organizationType: OrganizationType | null }[];
  countries: { id: string; name: string; cities: { id: string; name: string }[] }[];
}

export interface AccessRequestInput {
  roleKey: string;
  organizationId?: string;
  proposedOrganization?: ProposedOrganization;
  message?: string;
}

export interface ApplicantInput extends AccessRequestInput {
  msisdn: string;
  email: string;
  firstname: string;
  lastname: string;
  password: string;
}

const inPlace = () => new HttpContext().set(SILENT_ERRORS, true);

/** The applicant side of access requests. */
@Injectable({ providedIn: 'root' })
export class AccessApi {
  private readonly http = inject(HttpClient);

  options() {
    return firstValueFrom(this.http.get<RegistrationOptions>(apiUrl('/access-requests/options')));
  }

  organizations(type: OrganizationType, q: string) {
    const params = new HttpParams().set('type', type).set('q', q);
    return firstValueFrom(
      this.http.get<{ id: string; name: string; type: OrganizationType; city: string | null }[]>(
        apiUrl('/access-requests/organizations'),
        { params },
      ),
    );
  }

  /** Creates the account + first request and signs in (cookie session). */
  register(body: ApplicantInput) {
    return firstValueFrom(
      this.http.post<AccessToken>(apiUrl('/auth/register-applicant'), body, {
        headers: new HttpHeaders({ 'X-Auth-Mode': 'cookie' }),
        withCredentials: true,
        context: inPlace(),
      }),
    );
  }

  mine() {
    return firstValueFrom(this.http.get<AccessRequest[]>(apiUrl('/access-requests/mine')));
  }

  create(body: AccessRequestInput) {
    return firstValueFrom(this.http.post<AccessRequest>(apiUrl('/access-requests'), body, { context: inPlace() }));
  }

  respond(id: string, response: string) {
    return firstValueFrom(this.http.patch<AccessRequest>(apiUrl(`/access-requests/${id}/respond`), { response }));
  }

  cancel(id: string) {
    return firstValueFrom(this.http.post<AccessRequest>(apiUrl(`/access-requests/${id}/cancel`), {}));
  }
}
