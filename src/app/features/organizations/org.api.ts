import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS, type Page } from '../../core/api/api';
import type { OrganizationType } from '../../core/auth/auth.models';
import { toHttpParams, type ListQuery } from '../../shared/data/list-query';
import type {
  AffiliatedClub,
  Affiliation,
  AffiliationStatus,
  ClubProfile,
  Court,
  CourtStatus,
  CourtWindow,
  OrganizationDetail,
  OrganizationListItem,
  OrganizationStatus,
  SocialLinks,
  Surface,
  WeeklyHours,
} from './org.models';

const inPlace = { context: new HttpContext().set(SILENT_ERRORS, true) };

export interface OrganizationProfileInput {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  socialLinks?: SocialLinks;
}

export interface ClubInput extends OrganizationProfileInput {
  bannerUrl?: string | null;
  photos?: string[];
  cityId?: string;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: WeeklyHours;
  amenities?: string[];
}

export interface CourtInput {
  name?: string;
  number?: number | null;
  surface?: Surface;
  indoor?: boolean;
  lighting?: boolean;
  pricePerHour?: number | null;
  photos?: string[];
}

@Injectable({ providedIn: 'root' })
export class OrgApi {
  private readonly http = inject(HttpClient);
  private get<T>(path: string, params?: HttpParams) {
    return firstValueFrom(this.http.get<T>(apiUrl(path), { params }));
  }

  // Platform
  organizations(query: ListQuery) {
    return this.get<Page<OrganizationListItem>>('/admin/organizations', toHttpParams(query));
  }
  organization(id: string) {
    return this.get<OrganizationDetail>(`/admin/organizations/${id}`);
  }
  createOrganization(body: OrganizationProfileInput & { type: OrganizationType; name: string; cityId?: string }) {
    return firstValueFrom(this.http.post<OrganizationDetail>(apiUrl('/admin/organizations'), body, inPlace));
  }
  setOrganizationStatus(id: string, status: OrganizationStatus, reason?: string) {
    return firstValueFrom(this.http.patch<OrganizationDetail>(apiUrl(`/admin/organizations/${id}/status`), { status, reason }));
  }

  // Federation space
  federation(id: string) {
    return this.get<OrganizationDetail>(`/admin/federations/${id}`);
  }
  updateFederation(id: string, body: OrganizationProfileInput) {
    return firstValueFrom(this.http.patch<OrganizationDetail>(apiUrl(`/admin/federations/${id}`), body, inPlace));
  }
  federationClubs(id: string, query: ListQuery) {
    return this.get<Page<AffiliatedClub> & { counts: Partial<Record<AffiliationStatus, number>> }>(
      `/admin/federations/${id}/clubs`,
      toHttpParams(query),
    );
  }
  addClub(federationId: string, clubOrganizationId: string) {
    return firstValueFrom(this.http.post<Affiliation>(apiUrl(`/admin/federations/${federationId}/clubs`), { clubOrganizationId }));
  }
  decideAffiliation(federationId: string, affiliationId: string, action: 'approve' | 'suspend' | 'end', reason?: string) {
    return firstValueFrom(
      this.http.post<Affiliation>(apiUrl(`/admin/federations/${federationId}/affiliations/${affiliationId}/${action}`), { reason }),
    );
  }

  // Club space
  club(id: string) {
    return this.get<ClubProfile>(`/admin/clubs/${id}`);
  }
  updateClub(id: string, body: ClubInput) {
    return firstValueFrom(this.http.patch<ClubProfile>(apiUrl(`/admin/clubs/${id}`), body, inPlace));
  }
  requestAffiliation(clubId: string, federationId: string) {
    return firstValueFrom(this.http.post<Affiliation>(apiUrl(`/admin/clubs/${clubId}/affiliations`), { federationId }));
  }
  courts(clubId: string) {
    return this.get<{ clubHours: WeeklyHours | null; courts: Court[] }>(`/admin/clubs/${clubId}/courts`);
  }
  createCourt(clubId: string, body: CourtInput & { name: string; surface: Surface }) {
    return firstValueFrom(this.http.post<Court>(apiUrl(`/admin/clubs/${clubId}/courts`), body, inPlace));
  }
  updateCourt(courtId: string, body: CourtInput) {
    return firstValueFrom(this.http.patch<Court>(apiUrl(`/admin/courts/${courtId}`), body, inPlace));
  }
  setCourtStatus(courtId: string, status: CourtStatus, reason?: string) {
    return firstValueFrom(this.http.patch<Court>(apiUrl(`/admin/courts/${courtId}/status`), { status, reason }));
  }
  archiveCourt(courtId: string, reason?: string) {
    return firstValueFrom(this.http.post<Court>(apiUrl(`/admin/courts/${courtId}/archive`), { reason }));
  }
  restoreCourt(courtId: string) {
    return firstValueFrom(this.http.post<Court>(apiUrl(`/admin/courts/${courtId}/restore`), {}));
  }
  setCourtAvailability(courtId: string, windows: CourtWindow[]) {
    return firstValueFrom(this.http.put<Court>(apiUrl(`/admin/courts/${courtId}/availability`), { windows }, inPlace));
  }

  /** Image upload (JPEG/PNG/WebP, 5 MB) → public URL. */
  upload(folder: 'clubs' | 'courts' | 'organizations', file: File) {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.post<{ url: string }>(apiUrl(`/uploads/${folder}`), body, inPlace));
  }
}
