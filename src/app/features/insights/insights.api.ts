import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS, type Page } from '../../core/api/api';
import type { Payment } from '../club/club.models';
import type { Announcement, AnnouncementTarget, AppNotification, RankingRow, Report, ReportScope } from './insights.models';

const inPlace = { context: new HttpContext().set(SILENT_ERRORS, true) };
const REPORT_PATH: Record<ReportScope, string> = { club: 'clubs', tournament: 'tournaments', federation: 'federations' };
const TARGET_PATH: Record<AnnouncementTarget['kind'], string> = { tournament: 'tournaments', club: 'clubs', federation: 'federations' };

export interface ReportQuery {
  type: string;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class InsightsApi {
  private readonly http = inject(HttpClient);

  // Notifications (the signed-in user's own)
  notifications() {
    return firstValueFrom(this.http.get<{ unreadCount: number; items: AppNotification[] }>(apiUrl('/notifications')));
  }
  unreadCount() {
    return firstValueFrom(this.http.get<{ count: number }>(apiUrl('/notifications/unread-count'), inPlace));
  }
  markRead(id: string) {
    return firstValueFrom(this.http.patch(apiUrl(`/notifications/${id}/read`), {}, inPlace));
  }
  markAllRead() {
    return firstValueFrom(this.http.post(apiUrl('/notifications/read-all'), {}, inPlace));
  }

  // Announcements
  announcements(target: AnnouncementTarget) {
    return firstValueFrom(
      this.http.get<{ items: Announcement[]; reach: { all: number; byEvent: Record<string, number> } }>(
        apiUrl(`/admin/${TARGET_PATH[target.kind]}/${target.id}/announcements`),
      ),
    );
  }
  announce(target: AnnouncementTarget, body: { title: string; body: string; eventId?: string }) {
    return firstValueFrom(this.http.post<Announcement>(apiUrl(`/admin/${TARGET_PATH[target.kind]}/${target.id}/announcements`), body, inPlace));
  }

  // Reports
  report(scope: ReportScope, id: string, query: ReportQuery) {
    return firstValueFrom(this.http.get<Report>(apiUrl(`/admin/reports/${REPORT_PATH[scope]}/${id}`), { params: this.params(query) }));
  }
  reportCsv(scope: ReportScope, id: string, query: ReportQuery) {
    return firstValueFrom(
      this.http.get(apiUrl(`/admin/reports/${REPORT_PATH[scope]}/${id}`), { params: this.params(query).set('format', 'csv'), responseType: 'blob' }),
    );
  }

  // Federation rankings
  rankings(federationId: string, season: number, q: string, page: number, pageSize: number) {
    let params = new HttpParams().set('season', season).set('page', page).set('pageSize', pageSize);
    if (q) params = params.set('q', q);
    return firstValueFrom(this.http.get<Page<RankingRow> & { season: number }>(apiUrl(`/admin/federations/${federationId}/rankings`), { params }));
  }
  rankingsCsv(federationId: string, season: number) {
    return firstValueFrom(
      this.http.get(apiUrl(`/admin/federations/${federationId}/rankings`), { params: new HttpParams().set('season', season).set('format', 'csv'), responseType: 'blob' }),
    );
  }

  // Tournament entry fees
  payEntry(registrationId: string, body: { amount: number; methodKey: string; externalReference?: string; notes?: string }) {
    return firstValueFrom(this.http.post<Payment>(apiUrl(`/admin/registrations/${registrationId}/payments`), body, inPlace));
  }

  private params(query: ReportQuery) {
    let params = new HttpParams().set('type', query.type);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    return params;
  }
}
