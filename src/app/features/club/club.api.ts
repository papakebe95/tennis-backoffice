import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS, type Page } from '../../core/api/api';
import { toHttpParams, type ListQuery } from '../../shared/data/list-query';
import type {
  Candidate,
  ClubBooking,
  ClubDashboard,
  FederationPlayer,
  MemberDetail,
  Member,
  MemberStatus,
  Payment,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  Plan,
} from './club.models';

const inPlace = { context: new HttpContext().set(SILENT_ERRORS, true) };

export interface PaymentInput {
  purpose: PaymentPurpose;
  amount: number;
  methodKey: string;
  externalReference?: string;
  membershipId?: string;
  bookingId?: string;
  payerName?: string;
  notes?: string;
}

export interface FirstPayment {
  amount: number;
  methodKey: string;
  externalReference?: string;
}

@Injectable({ providedIn: 'root' })
export class ClubApi {
  private readonly http = inject(HttpClient);
  private get<T>(path: string, params?: HttpParams) {
    return firstValueFrom(this.http.get<T>(apiUrl(path), { params }));
  }

  dashboard(clubId: string) {
    return this.get<ClubDashboard>(`/admin/clubs/${clubId}/dashboard`);
  }

  // Plans
  plans(clubId: string) {
    return this.get<Plan[]>(`/admin/clubs/${clubId}/membership-plans`);
  }
  createPlan(clubId: string, body: { name: string; durationMonths: number; price: number; description?: string; active?: boolean }) {
    return firstValueFrom(this.http.post<Plan>(apiUrl(`/admin/clubs/${clubId}/membership-plans`), body, inPlace));
  }
  updatePlan(planId: string, body: Partial<{ name: string; durationMonths: number; price: number; description: string | null; active: boolean }>) {
    return firstValueFrom(this.http.patch<Plan>(apiUrl(`/admin/membership-plans/${planId}`), body, inPlace));
  }

  // Members
  members(clubId: string, query: ListQuery) {
    return this.get<Page<Member>>(`/admin/clubs/${clubId}/members`, toHttpParams(query));
  }
  exportMembers(clubId: string, query: ListQuery) {
    return firstValueFrom(
      this.http.get(apiUrl(`/admin/clubs/${clubId}/members`), {
        params: toHttpParams({ ...query, page: 1 }).set('format', 'csv'),
        responseType: 'blob',
      }),
    );
  }
  candidates(clubId: string, q: string) {
    return this.get<Candidate[]>(`/admin/clubs/${clubId}/member-candidates`, new HttpParams().set('q', q));
  }
  addMember(clubId: string, body: { userId: string; planId: string; startsAt?: string; membershipNumber?: string; notes?: string; payment?: FirstPayment }) {
    return firstValueFrom(this.http.post<MemberDetail>(apiUrl(`/admin/clubs/${clubId}/members`), body, inPlace));
  }
  member(memberId: string) {
    return this.get<MemberDetail>(`/admin/members/${memberId}`);
  }
  updateMember(memberId: string, body: { membershipNumber?: string; notes?: string | null }) {
    return firstValueFrom(this.http.patch<MemberDetail>(apiUrl(`/admin/members/${memberId}`), body, inPlace));
  }
  setMemberStatus(memberId: string, status: MemberStatus, reason?: string) {
    return firstValueFrom(this.http.patch<MemberDetail>(apiUrl(`/admin/members/${memberId}/status`), { status, reason }));
  }
  renew(memberId: string, body: { planId: string; payment?: FirstPayment }) {
    return firstValueFrom(this.http.post<MemberDetail>(apiUrl(`/admin/members/${memberId}/renew`), body, inPlace));
  }

  // Payments
  paymentMethods() {
    return this.get<PaymentMethod[]>('/admin/payments/methods');
  }
  payments(query: ListQuery) {
    return this.get<Page<Payment> & { totals: { status: PaymentStatus; currency: string; amount: string | number }[] }>(
      '/admin/payments',
      toHttpParams(query),
    );
  }
  exportPayments(query: ListQuery) {
    return firstValueFrom(
      this.http.get(apiUrl('/admin/payments'), { params: toHttpParams({ ...query, page: 1 }).set('format', 'csv'), responseType: 'blob' }),
    );
  }
  recordPayment(clubId: string, body: PaymentInput) {
    return firstValueFrom(this.http.post<Payment>(apiUrl(`/admin/clubs/${clubId}/payments`), body, inPlace));
  }
  refund(paymentId: string, reason: string) {
    return firstValueFrom(this.http.post<Payment>(apiUrl(`/admin/payments/${paymentId}/refund`), { reason }));
  }

  // Bookings
  bookings(clubId: string, query: ListQuery) {
    return this.get<Page<ClubBooking>>(`/admin/clubs/${clubId}/bookings`, toHttpParams(query));
  }
  cancelBooking(bookingId: string, reason: string) {
    return firstValueFrom(this.http.post<{ id: string }>(apiUrl(`/admin/bookings/${bookingId}/cancel`), { reason }));
  }

  // Federation
  federationPlayers(federationId: string, query: ListQuery) {
    return this.get<Page<FederationPlayer> & { clubs: { id: string; name: string }[] }>(
      `/admin/federations/${federationId}/players`,
      toHttpParams(query),
    );
  }
}

/** Saves a Blob as a file (CSV exports). */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
