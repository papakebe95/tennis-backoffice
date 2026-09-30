import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import type { Permission } from '../../core/authz/permissions';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbAgoPipe, TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AnnouncementsPanel } from '../insights/announcements-panel';
import { ReportView } from '../insights/report-view';
import { DrawPanel } from './draw-panel';
import { MatchesList } from './matches-list';
import { ScheduleBoard } from './schedule-board';
import { InterruptDialog } from './interrupt-dialog';
import { RegistrationsPanel } from './registrations-panel';
import { SettingsPanel } from './settings-panel';
import { TablesPanel } from './tables-panel';
import { TeamPanel } from './team-panel';
import { TournamentApi } from './tournament.api';
import type { TournamentDetail, TournamentStatus } from './tournament.models';
import { TournamentOverview } from './tournament-overview';

export const TOURNAMENT_TABS = ['overview', 'tables', 'registrations', 'draw', 'matches', 'schedule', 'announcements', 'reports', 'team', 'settings'] as const;
export type TournamentTab = (typeof TOURNAMENT_TABS)[number];

/** What a tournament screen may do, from the user's grants on it or its host. */
export type TournamentCan = (permission: Permission) => boolean;

/** /tournaments/:id and /tournaments/:id/:tab */
@Component({
  selector: 'tb-tournament-detail-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    SkeletonModule,
    TooltipModule,
    StatusBadge,
    EmptyState,
    TbDatePipe,
    TbAgoPipe,
    InterruptDialog,
    DrawPanel,
    AnnouncementsPanel,
    ReportView,
    MatchesList,
    ScheduleBoard,
    TournamentOverview,
    TablesPanel,
    RegistrationsPanel,
    TeamPanel,
    SettingsPanel,
  ],
  template: `
    <a class="back" routerLink="/tournaments"><i class="pi pi-arrow-left" aria-hidden="true"></i> {{ t('tournaments.back') }}</a>

    @if (tournament.error() && !tournament.value()) {
      <div class="tb-card"><tb-empty-state [message]="t('tournaments.loadError')" icon="pi pi-exclamation-triangle" /></div>
    } @else if (tournament.value(); as d) {
      <header class="tb-card head">
        <div class="banner" aria-hidden="true">
          @if (d.bannerUrl) {
            <img [src]="d.bannerUrl" alt="" />
          } @else {
            <i class="pi pi-trophy"></i>
          }
        </div>
        <div class="title">
          <div class="line">
            <h1>{{ d.name }}</h1>
            <tb-status-badge kind="tournament" [value]="d.status" />
            @if (d.visibility === 'PRIVATE') {
              <span class="tag"><i class="pi pi-lock" aria-hidden="true"></i> {{ t('tournaments.private') }}</span>
            }
          </div>
          <p class="meta">
            <span><i class="pi pi-calendar" aria-hidden="true"></i> {{ d.startDate | tbDate: 'date' }} → {{ d.endDate | tbDate: 'date' }}</span>
            <span><i class="pi pi-building" aria-hidden="true"></i> {{ d.hostOrganization ? t('tournaments.hostedBy', { name: d.hostOrganization.name }) : t('tournaments.independent') }}</span>
            @if (d.location || d.club) {
              <span><i class="pi pi-map-marker" aria-hidden="true"></i> {{ d.location ?? d.club?.name }}</span>
            }
            @if (d.registrationOpenNow) {
              <span class="open"><i class="pi pi-check-circle" aria-hidden="true"></i> {{ d.registrationClosesAt ? t('tournaments.registrationUntil', { date: (d.registrationClosesAt | tbDate: 'date') }) : t('tournaments.registrationOpenNow') }}</span>
            }
          </p>
        </div>
        <div class="actions">
          @if (can('tournament.lifecycle.manage')) {
            @for (option of forwardTransitions(); track option.to) {
              <span [pTooltip]="blockerText(option.blockers)" tooltipPosition="bottom">
                <p-button
                  [label]="transitionLabel(d.status, option.to)"
                  [severity]="option.to === 'REGISTRATION_OPEN' && d.status === 'REGISTRATION_CLOSED' ? 'secondary' : undefined"
                  [outlined]="option.to === 'REGISTRATION_OPEN' && d.status === 'REGISTRATION_CLOSED'"
                  [disabled]="option.blockers.length > 0 || busy()"
                  (onClick)="transition(d, option.to)"
                />
              </span>
            }
          }
          @if (d.status === 'IN_PROGRESS' && can('tournament.interrupt')) {
            <p-button [label]="t('tournaments.interruption.interrupt')" icon="pi pi-pause" severity="warn" [outlined]="true" (onClick)="interruptOpen.set(true)" />
          }
          @if (d.status === 'INTERRUPTED' && can('tournament.interrupt')) {
            <p-button [label]="t('tournaments.interruption.resume')" icon="pi pi-play" severity="success" [disabled]="busy()" (onClick)="resume(d)" />
          }
          @if (canCancel()) {
            <p-button [label]="t('tournaments.lifecycle.actions.CANCELLED')" icon="pi pi-ban" severity="danger" [text]="true" [disabled]="busy()" (onClick)="transition(d, 'CANCELLED')" />
          }
        </div>
      </header>

      @if (d.interruption; as i) {
        <div class="banner-alert warning" role="status">
          <i class="pi pi-pause-circle" aria-hidden="true"></i>
          <span>{{ t('tournaments.interruption.banner', { since: (i.startedAt | tbAgo), reason: t('tournaments.interruptionReasons.' + i.reason) }) }}{{ i.note ? ' — ' + i.note : '' }}</span>
        </div>
      }
      @if (d.status === 'CANCELLED' && d.cancelledAt) {
        <div class="banner-alert danger" role="status">
          <i class="pi pi-ban" aria-hidden="true"></i>
          <span>{{ t('tournaments.lifecycle.cancelled', { date: (d.cancelledAt | tbDate: 'date'), reason: d.cancelReason ?? '' }) }}</span>
        </div>
      }

      <nav class="tabs" [attr.aria-label]="d.name">
        @for (tab of tabs(); track tab) {
          <a [routerLink]="tab === 'overview' ? ['/tournaments', d.id] : ['/tournaments', d.id, tab]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            {{ t('tournaments.tabs.' + tab) }}
            @if (tab === 'registrations' && d.stats.entries.PENDING) {
              <span class="count">{{ d.stats.entries.PENDING }}</span>
            }
          </a>
        }
      </nav>

      @switch (currentTab()) {
        @case ('tables') {
          <tb-tables-panel [tournament]="d" [can]="can" (changed)="tournament.reload()" />
        }
        @case ('registrations') {
          <tb-registrations-panel [tournament]="d" [can]="can" (changed)="tournament.reload()" />
        }
        @case ('draw') {
          <tb-draw-panel [tournament]="d" [can]="can" (changed)="tournament.reload()" />
        }
        @case ('matches') {
          <tb-matches-list [competitionId]="d.id" (changed)="tournament.reload()" />
        }
        @case ('schedule') {
          <tb-schedule-board [tournament]="d" [can]="can" (changed)="tournament.reload()" />
        }
        @case ('announcements') {
          <tb-announcements-panel [target]="{ kind: 'tournament', id: d.id }" [canSend]="can('tournament.announce')" [events]="d.events" />
        }
        @case ('reports') {
          <tb-report-view scope="tournament" [subjectId]="d.id" [canExport]="can('report.export')" />
        }
        @case ('team') {
          <tb-team-panel [tournament]="d" [can]="can" (changed)="tournament.reload()" />
        }
        @case ('settings') {
          <tb-settings-panel [tournament]="d" [can]="can" (changed)="tournament.set($event)" />
        }
        @default {
          <tb-tournament-overview [tournament]="d" />
        }
      }

      <tb-interrupt-dialog [tournamentId]="d.id" [(visible)]="interruptOpen" (done)="tournament.set($event)" />
    } @else {
      <p-skeleton height="140px" borderRadius="14px" />
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-5); }
    .back { display: inline-flex; align-items: center; gap: var(--tb-space-2); color: var(--tb-text-muted); text-decoration: none; font-weight: var(--tb-weight-medium); margin-bottom: calc(-1 * var(--tb-space-2)); }
    .head { display: grid; grid-template-columns: auto 1fr; gap: var(--tb-space-4); align-items: center; }
    .banner { width: 88px; height: 88px; border-radius: var(--tb-radius-lg); overflow: hidden; display: grid; place-items: center; background: var(--tb-primary-50); color: var(--tb-primary-700); font-size: 1.75rem; }
    .banner img { width: 100%; height: 100%; object-fit: cover; }
    .title { min-width: 0; }
    .line { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); }
    h1 { font-size: var(--tb-text-2xl); margin: 0; }
    .tag { display: inline-flex; align-items: center; gap: 4px; font-size: var(--tb-text-xs); color: var(--tb-text-muted); }
    .meta { display: flex; flex-wrap: wrap; gap: var(--tb-space-2) var(--tb-space-5); margin: var(--tb-space-2) 0 0; color: var(--tb-text-muted); font-size: var(--tb-text-sm); }
    .meta i { margin-right: 4px; }
    .meta .open { color: var(--tb-tone-success-fg); }
    .actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--tb-space-2); justify-content: flex-end; }
    .actions:empty { display: none; }
    @media (min-width: 1100px) {
      .head { grid-template-columns: auto 1fr auto; }
      .actions { grid-column: auto; }
    }
    .banner-alert { display: flex; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3) var(--tb-space-4); border-radius: var(--tb-radius-md); font-weight: var(--tb-weight-medium); }
    .banner-alert.warning { background: var(--tb-tone-warning-bg); color: var(--tb-tone-warning-fg); }
    .banner-alert.danger { background: var(--tb-tone-danger-bg); color: var(--tb-tone-danger-fg); }
    .tabs { display: flex; gap: var(--tb-space-1); border-bottom: 1px solid var(--tb-border); overflow-x: auto; }
    .tabs a { padding: var(--tb-space-3) var(--tb-space-4); color: var(--tb-text-muted); text-decoration: none; font-weight: var(--tb-weight-medium); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; display: inline-flex; align-items: center; gap: var(--tb-space-2); }
    .tabs a:hover { color: var(--tb-text); }
    .tabs a.active { color: var(--tb-primary-700); border-bottom-color: var(--tb-primary-600); }
    .count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--tb-radius-full); background: var(--tb-tone-warning-bg); color: var(--tb-tone-warning-fg); font-size: var(--tb-text-xs); display: inline-grid; place-items: center; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentDetailPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  /** Route params. */
  readonly id = input.required<string>();
  readonly tab = input<string>();

  protected readonly tournament = resource({ params: () => this.id(), loader: ({ params }) => this.api.detail(params) });
  protected readonly busy = signal(false);
  protected readonly interruptOpen = signal(false);

  protected readonly currentTab = computed<TournamentTab>(() =>
    TOURNAMENT_TABS.includes(this.tab() as TournamentTab) ? (this.tab() as TournamentTab) : 'overview',
  );

  /** Permission on this tournament: grants on it, on its host, or global. */
  protected readonly can: TournamentCan = (permission) => {
    const d = this.tournament.value();
    return !!d && this.authz.hasPermission(permission, { competitionId: d.id, organizationId: d.hostOrganizationId ?? undefined });
  };

  protected readonly tabs = computed(() =>
    TOURNAMENT_TABS.filter((tab) =>
      tab === 'registrations' ? this.can('registration.view') : tab === 'draw' ? this.can('draw.view') : tab === 'matches' || tab === 'schedule' ? this.can('match.view') : tab === 'reports' ? this.can('report.view') : tab === 'settings' ? this.can('tournament.update') || this.can('tournament.delete') : true,
    ),
  );

  /** Every move but cancelling, which gets its own quieter button. */
  protected readonly forwardTransitions = computed(() => (this.tournament.value()?.transitions ?? []).filter((o) => o.to !== 'CANCELLED'));
  protected readonly canCancel = computed(
    () => this.can('tournament.lifecycle.manage') && !!this.tournament.value()?.transitions.some((o) => o.to === 'CANCELLED'),
  );

  protected transitionLabel(from: TournamentStatus, to: TournamentStatus) {
    return from === 'REGISTRATION_CLOSED' && to === 'REGISTRATION_OPEN'
      ? this.t('tournaments.lifecycle.reopen')
      : this.t(`tournaments.lifecycle.actions.${to}`);
  }

  protected blockerText(blockers: string[]) {
    return blockers.map((b) => this.t(`tournaments.lifecycle.blockers.${b}`)).join(' · ') || '';
  }

  protected async transition(d: TournamentDetail, to: TournamentStatus) {
    const cancelling = to === 'CANCELLED';
    const answer = await this.confirm.ask({
      title: this.transitionLabel(d.status, to),
      message: d.name,
      detail: this.t(`tournaments.lifecycle.confirm.${to}`),
      confirmLabel: this.transitionLabel(d.status, to),
      severity: cancelling ? 'danger' : 'primary',
      reason: cancelling ? 'required' : 'none',
    });
    if (!answer) return;
    await this.run(() => this.api.transition(d.id, to, answer.reason), 'tournaments.lifecycle.done');
  }

  protected async resume(d: TournamentDetail) {
    const answer = await this.confirm.ask({
      title: this.t('tournaments.interruption.resumeTitle'),
      message: d.name,
      detail: this.t('tournaments.interruption.resumeMessage'),
      confirmLabel: this.t('tournaments.interruption.resume'),
    });
    if (!answer) return;
    await this.run(() => this.api.resume(d.id, true), 'tournaments.lifecycle.done');
  }

  private async run(action: () => Promise<TournamentDetail>, success: string) {
    this.busy.set(true);
    try {
      this.tournament.set(await action());
      this.toasts.add({ severity: 'success', summary: this.t(success) });
    } catch (raw) {
      const error = ApiError.from(raw);
      const detail = error.blockers.length ? this.blockerText(error.blockers) : undefined;
      this.toasts.add({ severity: 'error', summary: describeError(error, this.t), detail });
    } finally {
      this.busy.set(false);
    }
  }
}
