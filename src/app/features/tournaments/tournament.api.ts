import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS, type Page } from '../../core/api/api';
import { toHttpParams, type ListQuery } from '../../shared/data/list-query';
import type {
  Classification,
  DrawCandidates,
  DrawEntrant,
  DrawView,
  Decision,
  EntryCandidate,
  EntryType,
  EventInput,
  Gender,
  HostOptions,
  InterruptionReason,
  NewTournamentInput,
  RegistrationPage,
  RegistrationStatus,
  StaffView,
  TournamentDetail,
  TournamentEvent,
  TournamentInput,
  TournamentListItem,
  TournamentStatus,
} from './tournament.models';

/** Errors of these calls are shown in place (forms, dialogs), not as toasts. */
const inPlace = { context: new HttpContext().set(SILENT_ERRORS, true) };

export interface EntryInput {
  userId: string;
  partnerUserId?: string | null;
  entryType?: EntryType;
  sourceEventId?: string | null;
  status?: RegistrationStatus;
  overrideReason?: string;
}

@Injectable({ providedIn: 'root' })
export class TournamentApi {
  private readonly http = inject(HttpClient);
  private get<T>(path: string, params?: HttpParams) {
    return firstValueFrom(this.http.get<T>(apiUrl(path), { params }));
  }
  private send<T>(method: 'post' | 'patch' | 'delete', path: string, body?: unknown) {
    const url = apiUrl(path);
    return firstValueFrom(
      method === 'delete' ? this.http.delete<T>(url, inPlace) : this.http[method]<T>(url, body ?? {}, inPlace),
    );
  }

  // Tournaments
  list(query: ListQuery) {
    return this.get<Page<TournamentListItem>>('/admin/tournaments', toHttpParams(query));
  }
  hostOptions() {
    return this.get<HostOptions>('/admin/tournaments/host-options');
  }
  detail(id: string) {
    return this.get<TournamentDetail>(`/admin/tournaments/${id}`);
  }
  create(body: NewTournamentInput) {
    return this.send<TournamentDetail>('post', '/admin/tournaments', body);
  }
  update(id: string, body: TournamentInput) {
    return this.send<TournamentDetail>('patch', `/admin/tournaments/${id}`, body);
  }
  remove(id: string) {
    return this.send<void>('delete', `/admin/tournaments/${id}`);
  }
  transition(id: string, to: TournamentStatus, reason?: string, notify?: boolean) {
    return this.send<TournamentDetail>('post', `/admin/tournaments/${id}/transitions`, { to, reason, notify });
  }
  interrupt(id: string, body: { reason: InterruptionReason; note?: string; notify: boolean }) {
    return this.send<TournamentDetail>('post', `/admin/tournaments/${id}/interrupt`, body);
  }
  resume(id: string, notify: boolean) {
    return this.send<TournamentDetail>('post', `/admin/tournaments/${id}/resume`, { notify });
  }

  // Tables (events)
  createEvent(tournamentId: string, body: Partial<EventInput> & { name: string }) {
    return this.send<TournamentEvent>('post', `/admin/tournaments/${tournamentId}/events`, body);
  }
  updateEvent(eventId: string, body: Partial<EventInput>) {
    return this.send<TournamentEvent>('patch', `/admin/events/${eventId}`, body);
  }
  removeEvent(eventId: string) {
    return this.send<void>('delete', `/admin/events/${eventId}`);
  }

  // Registrations
  registrations(eventId: string, query: ListQuery) {
    return this.get<RegistrationPage>(`/admin/events/${eventId}/registrations`, toHttpParams(query));
  }
  entryCandidates(eventId: string, q: string) {
    return this.get<EntryCandidate[]>(`/admin/events/${eventId}/entry-candidates`, new HttpParams().set('q', q));
  }
  qualifierSources(eventId: string) {
    return this.get<{ id: string; name: string; qualifierCount: number }[]>(`/admin/events/${eventId}/qualifier-sources`);
  }
  addEntry(eventId: string, body: EntryInput) {
    return this.send<{ id: string }>('post', `/admin/events/${eventId}/registrations`, body);
  }
  decide(registrationId: string, decision: Decision, body: { reason?: string; overrideReason?: string; notify?: boolean } = {}) {
    return this.send<void>('post', `/admin/registrations/${registrationId}/${decision}`, body);
  }
  setSeed(registrationId: string, seed: number | null) {
    return this.send<void>('patch', `/admin/registrations/${registrationId}/seed`, { seed });
  }

  // Draw
  draw(eventId: string) {
    return this.get<DrawView>(`/admin/events/${eventId}/draw`);
  }
  drawCandidates(eventId: string) {
    return this.get<DrawCandidates>(`/admin/events/${eventId}/draw/candidates`);
  }
  generateDraw(eventId: string, body: { seedCount?: number; qualifierPlaces?: number; emptyPlaces?: number; size?: number }) {
    return this.send<DrawView>('post', `/admin/events/${eventId}/draw/generate`, body);
  }
  drawAction(eventId: string, action: 'reset' | 'publish' | 'lock') {
    return this.send<DrawView>('post', `/admin/events/${eventId}/draw/${action}`);
  }
  swapSlots(eventId: string, a: number, b: number, version: number) {
    return this.send<DrawView>('post', `/admin/events/${eventId}/draw/swap`, { a, b, version });
  }
  fillSlot(eventId: string, position: number, body: DrawEntrant) {
    return this.send<DrawView>('post', `/admin/events/${eventId}/draw/slots/${position}/fill`, body);
  }
  replaceInSlot(eventId: string, position: number, body: DrawEntrant) {
    return this.send<DrawView>('post', `/admin/events/${eventId}/draw/slots/${position}/replace`, body);
  }

  // Team
  staff(tournamentId: string) {
    return this.get<StaffView>(`/admin/tournaments/${tournamentId}/staff`);
  }
  staffCandidates(tournamentId: string, q: string) {
    return this.get<{ id: string; firstname: string; lastname: string; phone: string }[]>(
      `/admin/tournaments/${tournamentId}/staff-candidates`,
      new HttpParams().set('q', q),
    );
  }
  addStaff(tournamentId: string, userId: string, roleKey: string) {
    return this.send<StaffView>('post', `/admin/tournaments/${tournamentId}/staff`, { userId, roleKey });
  }
  removeStaff(tournamentId: string, grantId: string, reason?: string) {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return this.send<StaffView>('delete', `/admin/tournaments/${tournamentId}/staff/${grantId}${params}`);
  }

  // Players' sport identity
  classifications() {
    return this.get<Classification[]>('/admin/classifications');
  }
  updateSportProfile(userId: string, body: { classificationId?: string | null; gender?: Gender | null; birthDate?: string | null }) {
    return this.send<unknown>('patch', `/admin/players/${userId}/sport-profile`, body);
  }
}
