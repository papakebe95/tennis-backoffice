import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import type { Permission } from '../../core/authz/permissions';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { auditActionLabel, formatDate, fromWallClock, TbAgoPipe, TbDatePipe, wallClockIso } from '../../shared/format';
import { ConfirmService } from '../../shared/ui/confirm';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ScoreForm } from './score-form';
import { TournamentApi } from './tournament.api';
import { roundLabel, sideName, type MatchDetail, type MatchSide, type ScheduleConflict, type TournamentMatch } from './tournament.models';

/**
 * One match: players and score, scheduling (court and time, with the
 * conflicts the API finds), official, result entry and validation,
 * postponement and disputes, and its history.
 */
@Component({
  selector: 'tb-match-drawer',
  imports: [FormsModule, ButtonModule, DatePickerModule, DrawerModule, MessageModule, SelectModule, SkeletonModule, StatusBadge, TbDatePipe, TbAgoPipe, ScoreForm],
  template: `
    <p-drawer [visible]="!!matchId()" (visibleChange)="!$event && closed.emit()" position="right" styleClass="tb-drawer tb-drawer-lg" [header]="title()">
      @if (detail.value(); as m) {
        <div class="badges">
          <tb-status-badge kind="match" [value]="m.status" />
          @if (m.resultStatus !== 'NONE') {
            <tb-status-badge kind="result" [value]="m.resultStatus" />
          }
          <span class="tb-muted small">{{ m.competition.name }}</span>
        </div>

        <section class="players">
          @for (s of [1, 2]; track s) {
            @let side = s === 1 ? m.side1 : m.side2;
            <div class="player" [class.winner]="m.winnerSide === s">
              @if (side) {
                @if (side.seed) {
                  <span class="seed">{{ side.seed }}</span>
                }
                <span class="name">{{ name(side) }}</span>
                <small class="tb-muted">{{ side.player.classification ?? 'NC' }}</small>
              } @else {
                <span class="name muted">{{ placeholder(m, s) }}</span>
              }
              <span class="games">
                @for (set of m.sets; track set.setNumber) {
                  <span [class.won]="(s === 1 ? set.side1Games > set.side2Games : set.side2Games > set.side1Games)">
                    {{ set.isSuperTiebreak ? (s === 1 ? set.tiebreak1 : set.tiebreak2) : s === 1 ? set.side1Games : set.side2Games }}@if (!set.isSuperTiebreak && set.tiebreak1 !== null && (s === 1 ? set.side1Games < set.side2Games : set.side2Games < set.side1Games)) {<sup>{{ s === 1 ? set.tiebreak1 : set.tiebreak2 }}</sup>}
                  </span>
                }
              </span>
              @if (m.winnerSide === s) {
                <i class="pi pi-check-circle win" aria-hidden="true"></i>
              }
            </div>
          }
          @if (m.outcome === 'WALKOVER' || m.outcome === 'RETIRED') {
            <p class="tb-muted small">{{ t(m.outcome === 'WALKOVER' ? 'matches.walkover' : 'matches.retired') }} · {{ name(m.loserSide === 1 ? m.side1 : m.side2) }}</p>
          }
        </section>

        @if (m.resultStatus === 'ENTERED') {
          <p-message severity="warn" class="msg">
            <div class="alert">
              <span>{{ t('matches.drawer.awaiting') }}</span>
              @if (can('match.result.validate')) {
                <p-button [label]="t('matches.drawer.validate')" icon="pi pi-verified" size="small" [loading]="busy()" (onClick)="run(api.validateResult(m.id), 'matches.drawer.validated')" />
              }
            </div>
          </p-message>
        }
        @if (m.resultStatus === 'DISPUTED') {
          <p-message severity="error" class="msg">
            <div class="alert">
              <span>{{ t('matches.drawer.disputed', { reason: m.disputeReason ?? '' }) }}</span>
              @if (can('match.result.validate')) {
                <p-button [label]="t('matches.drawer.validate')" icon="pi pi-verified" size="small" [loading]="busy()" (onClick)="run(api.validateResult(m.id), 'matches.drawer.validated')" />
              }
            </div>
          </p-message>
        }

        <div class="actions">
          @if ((m.status === 'READY' || m.status === 'SCHEDULED') && m.competition.status === 'IN_PROGRESS' && can('match.result.enter')) {
            <p-button [label]="t('matches.drawer.startMatch')" icon="pi pi-play" severity="success" [outlined]="true" size="small" [loading]="busy()" (onClick)="run(api.startMatch(m.id), 'matches.drawer.started')" />
          }
          @if (m.status !== 'COMPLETED' && m.status !== 'BYE' && m.status !== 'POSTPONED' && can('match.status.manage')) {
            <p-button [label]="t('matches.drawer.postpone')" icon="pi pi-clock" severity="warn" [text]="true" size="small" (onClick)="postpone(m)" />
          }
          @if ((m.resultStatus === 'ENTERED' || m.resultStatus === 'VALIDATED') && can('match.status.manage')) {
            <p-button [label]="t('matches.drawer.dispute')" icon="pi pi-flag" severity="danger" [text]="true" size="small" (onClick)="dispute(m)" />
          }
        </div>

        @if (m.status !== 'COMPLETED' && m.status !== 'BYE' && m.status !== 'LIVE' && can('match.schedule')) {
          <section>
            <h3>{{ t('matches.drawer.schedule') }}</h3>
            <div class="two">
              <div class="tb-field">
                <label for="md-start">{{ t('matches.drawer.start') }}</label>
                <p-datepicker inputId="md-start" [ngModel]="when()" (ngModelChange)="when.set($event)" [showTime]="true" [stepMinute]="15" hourFormat="24" dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" [fluid]="true" />
              </div>
              <div class="tb-field">
                <label for="md-court">{{ t('matches.drawer.court') }}</label>
                <p-select inputId="md-court" [options]="courtChoices()" [ngModel]="courtId()" (ngModelChange)="courtId.set($event)" [group]="true" optionGroupLabel="label" optionGroupChildren="items" appendTo="body" [fluid]="true" />
              </div>
            </div>
            @if (conflicts().length) {
              <p-message severity="error" class="msg">
                <div>
                  <strong>{{ t('matches.drawer.conflicts') }}</strong>
                  <ul>
                    @for (c of conflicts(); track $index) {
                      <li>{{ t('matches.drawer.conflictTypes.' + c.type) }} · {{ c.label }} ({{ c.start | tbDate: 'time' }}–{{ c.end | tbDate: 'time' }})</li>
                    }
                  </ul>
                </div>
              </p-message>
            }
            <div class="row-actions">
              @if (m.scheduledAt) {
                <p-button [label]="t('matches.drawer.unschedule')" severity="secondary" [text]="true" size="small" (onClick)="run(api.unscheduleMatch(m.id), 'matches.drawer.scheduled')" />
              }
              <p-button [label]="t('matches.drawer.save')" icon="pi pi-calendar-plus" size="small" [disabled]="!when() || !courtId()" [loading]="busy()" (onClick)="schedule(m)" />
            </div>
          </section>
        } @else if (m.scheduledAt) {
          <p class="when"><i class="pi pi-calendar" aria-hidden="true"></i> {{ m.scheduledAt | tbDate: 'slot' }} · {{ m.court?.name }}</p>
        }

        @if (can('match.schedule')) {
          <section>
            <h3>{{ t('matches.drawer.official') }}</h3>
            <p-select [options]="officialChoices()" [ngModel]="m.official?.id ?? null" (ngModelChange)="assign(m, $event)" [placeholder]="t('matches.drawer.noOfficial')" [showClear]="true" appendTo="body" [fluid]="true" [attr.aria-label]="t('matches.drawer.official')" />
          </section>
        } @else if (m.official) {
          <p class="small tb-muted">{{ t('matches.drawer.official') }} : {{ m.official.firstname }} {{ m.official.lastname }}</p>
        }

        @if (m.side1 && m.side2 && m.status !== 'BYE' && playing() && can('match.result.enter')) {
          <section>
            <h3>{{ t('matches.drawer.result') }}</h3>
            @if (m.resultStatus !== 'VALIDATED' || correcting()) {
              <tb-score-form [match]="m" [mayValidate]="can('match.result.validate')" (saved)="savedResult($event)" />
            } @else if (can('match.result.validate')) {
              <p-button [label]="t('matches.drawer.correct')" icon="pi pi-pencil" severity="secondary" [outlined]="true" size="small" (onClick)="correcting.set(true)" />
            }
          </section>
        } @else if (!m.side1 || !m.side2) {
          <p class="tb-muted small">{{ t('matches.drawer.waitingSides') }}</p>
        }

        @if (m.activity.length) {
          <section>
            <h3>{{ t('matches.drawer.activity') }}</h3>
            <ul class="feed">
              @for (a of m.activity; track a.id) {
                <li>
                  <span>{{ label(a.action) }}</span>
                  <small class="tb-muted">{{ a.actor ? a.actor.firstname + ' ' + a.actor.lastname : '' }} · {{ a.createdAt | tbAgo }}</small>
                  @if (a.reason) {
                    <small class="reason">« {{ a.reason }} »</small>
                  }
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <p-skeleton height="200px" />
      }
    </p-drawer>
  `,
  styles: `
    section { margin-top: var(--tb-space-5); }
    h3 { font-size: var(--tb-text-sm); text-transform: uppercase; letter-spacing: 0.04em; color: var(--tb-text-muted); margin: 0 0 var(--tb-space-2); }
    .badges { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); align-items: center; }
    .small { font-size: var(--tb-text-sm); }
    .players { display: grid; gap: 2px; margin-top: var(--tb-space-4); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); overflow: hidden; }
    .player { display: flex; align-items: center; gap: var(--tb-space-2); padding: var(--tb-space-3); background: var(--tb-surface); }
    .player + .player { border-top: 1px solid var(--tb-border); }
    .player.winner .name { font-weight: var(--tb-weight-bold); }
    .seed { min-width: 20px; height: 18px; border-radius: 4px; background: var(--tb-primary-600); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
    .name { flex: 1; min-width: 0; }
    .name.muted { color: var(--tb-text-subtle); font-style: italic; }
    .games { display: flex; gap: var(--tb-space-3); font-variant-numeric: tabular-nums; font-size: var(--tb-text-lg); color: var(--tb-text-muted); }
    .games .won { color: var(--tb-text); font-weight: var(--tb-weight-bold); }
    .games sup { font-size: 10px; }
    .win { color: var(--tb-tone-success-fg); }
    .players p { margin: 0; padding: var(--tb-space-2) var(--tb-space-3); }
    .msg { display: block; margin-top: var(--tb-space-3); }
    .msg ul { margin: var(--tb-space-1) 0 0; padding-left: var(--tb-space-5); }
    .alert { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-space-3); flex-wrap: wrap; width: 100%; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); margin-top: var(--tb-space-3); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tb-space-3); }
    .row-actions { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
    .when { margin: var(--tb-space-4) 0 0; font-weight: var(--tb-weight-medium); }
    .feed { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--tb-space-2); }
    .feed li { display: grid; gap: 2px; font-size: var(--tb-text-sm); }
    .reason { color: var(--tb-text-muted); font-style: italic; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchDrawer {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly api = inject(TournamentApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly matchId = input<string | null>(null);
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly detail = resource({ params: () => this.matchId() ?? undefined, loader: ({ params }) => this.api.match(params) });
  private readonly competitionId = computed(() => this.detail.value()?.competition.id);
  private readonly courts = resource({ params: () => this.competitionId(), loader: ({ params }) => this.api.courtOptions(params) });
  private readonly officials = resource({
    params: () => (this.competitionId() && this.can('match.schedule') ? this.competitionId() : undefined),
    loader: ({ params }) => this.api.officials(params),
  });

  protected readonly when = signal<Date | null>(null);
  protected readonly courtId = signal<string | null>(null);
  protected readonly conflicts = signal<ScheduleConflict[]>([]);
  protected readonly busy = signal(false);
  /** A validated result is shown read-only until "correct" is chosen. */
  protected readonly correcting = signal(false);

  protected readonly title = computed(() => {
    const m = this.detail.value();
    if (!m) return '';
    const round = m.round.rounds ? roundLabel(m.round.number, m.round.rounds) : null;
    return `${m.event.name} · ${round ? this.t(round.key, round.params) : m.round.name}`;
  });
  protected readonly playing = computed(() => ['IN_PROGRESS', 'INTERRUPTED'].includes(this.detail.value()?.competition.status ?? ''));
  /** Chosen courts, else the venue's (as the API decides), grouped by club. */
  protected readonly courtChoices = computed(() => {
    const options = this.courts.value();
    if (!options) return [];
    const usable = options.usesVenueDefault ? options.courts : options.courts.filter((c) => c.chosen);
    const groups = new Map<string, { label: string; items: { label: string; value: string }[] }>();
    for (const c of usable) {
      const group = groups.get(c.club.id) ?? { label: c.club.name, items: [] };
      group.items.push({ label: c.name, value: c.id });
      groups.set(c.club.id, group);
    }
    return [...groups.values()];
  });
  protected readonly officialChoices = computed(() =>
    (this.officials.value() ?? []).map((o) => ({ label: `${o.firstname} ${o.lastname} · ${o.roles.join(', ')}`, value: o.id })),
  );

  constructor() {
    effect(() => {
      const m = this.detail.value();
      this.when.set(m?.scheduledAt ? fromWallClock(m.scheduledAt) : null);
      this.courtId.set(m?.court?.id ?? null);
      this.conflicts.set([]);
      this.correcting.set(false);
    });
  }

  /** Grants on this match's tournament or its host (the API re-checks, including officials' assignment). */
  protected can(permission: Permission) {
    const m = this.detail.value();
    return !!m && this.authz.hasPermission(permission, { competitionId: m.competition.id, organizationId: m.competition.hostOrganizationId ?? undefined });
  }

  protected name(side: MatchSide | null) {
    return sideName(side);
  }

  protected placeholder(m: MatchDetail, side: number) {
    const slot = m.placeholders.find((p) => p.position === 2 * m.position + side - 1);
    if (slot?.kind === 'BYE') return this.t('tournaments.draw.bye');
    if (slot?.kind === 'QUALIFIER') return this.t('tournaments.draw.qualifierPlace', { label: slot.label ?? 'Q' });
    if (slot?.kind === 'EMPTY') return this.t('tournaments.draw.emptyPlace');
    return this.t('matches.tbd');
  }

  protected label(action: string) {
    return auditActionLabel(this.i18n, action);
  }

  protected async schedule(m: MatchDetail) {
    const when = this.when();
    const courtId = this.courtId();
    if (!when || !courtId) return;
    this.conflicts.set([]);
    this.busy.set(true);
    try {
      await this.api.scheduleMatch(m.id, wallClockIso(when), courtId);
      this.toasts.add({ severity: 'success', summary: this.t('matches.drawer.scheduled'), detail: formatDate(wallClockIso(when), this.i18n.lang(), 'slot') });
      this.refresh();
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.code === 'SCHEDULE_CONFLICT') this.conflicts.set(error.issues as ScheduleConflict[]);
      else this.toasts.add({ severity: 'error', summary: describeError(error, this.t) });
    } finally {
      this.busy.set(false);
    }
  }

  protected async assign(m: MatchDetail, userId: string | null) {
    await this.run(this.api.assignOfficial(m.id, userId ?? null), 'matches.drawer.officialSaved');
  }

  protected async postpone(m: MatchDetail) {
    const answer = await this.confirm.ask({
      title: this.t('matches.drawer.postponeTitle'),
      message: this.title(),
      detail: this.t('matches.drawer.postponeMessage'),
      confirmLabel: this.t('matches.drawer.postpone'),
      severity: 'warn',
      reason: 'required',
      reasonLabel: this.t('matches.drawer.reasonLabel'),
    });
    if (answer?.reason) await this.run(this.api.postponeMatch(m.id, answer.reason), 'matches.drawer.postponedDone');
  }

  protected async dispute(m: MatchDetail) {
    const answer = await this.confirm.ask({
      title: this.t('matches.drawer.disputeTitle'),
      message: this.title(),
      detail: this.t('matches.drawer.disputeMessage'),
      confirmLabel: this.t('matches.drawer.dispute'),
      severity: 'danger',
      reason: 'required',
      reasonLabel: this.t('matches.drawer.reasonLabel'),
    });
    if (answer?.reason) await this.run(this.api.disputeResult(m.id, answer.reason), 'matches.drawer.disputedDone');
  }

  protected savedResult(match: TournamentMatch) {
    this.toasts.add({
      severity: 'success',
      summary: this.t(match.resultStatus === 'VALIDATED' ? 'matches.drawer.validated' : 'matches.drawer.saved'),
      detail: match.score || undefined,
    });
    this.refresh();
  }

  protected async run(action: Promise<unknown>, success: string) {
    this.busy.set(true);
    try {
      await action;
      this.toasts.add({ severity: 'success', summary: this.t(success) });
      this.refresh();
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.busy.set(false);
    }
  }

  private refresh() {
    this.detail.reload();
    this.changed.emit();
  }
}
