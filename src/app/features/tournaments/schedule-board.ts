import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatDate, TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { MatchDrawer } from './match-drawer';
import { TournamentApi } from './tournament.api';
import { roundLabel, sideName, type ScheduleConflict, type TournamentDetail, type TournamentMatch } from './tournament.models';
import type { TournamentCan } from './tournament-detail.page';

const STEP = 30; // minutes per grid row
const ROW = 30; // px per grid row
const SNAP = 15; // minutes

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Minutes after UTC midnight (tournament wall clock). */
const minuteOfDay = (iso: string) => {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * The "Schedule" tab: one day of the tournament as courts × time. Matches
 * to schedule are dragged onto a court and a time; scheduled ones can be
 * moved the same way. Bookings and other tournaments occupy their slots and
 * closed hours are shaded — the API checks all of it again.
 */
@Component({
  selector: 'tb-schedule-board',
  imports: [FormsModule, ButtonModule, CheckboxModule, DialogModule, SkeletonModule, EmptyState, TbDatePipe, MatchDrawer],
  template: `
    <section class="tb-card head">
      <div class="days" role="tablist" [attr.aria-label]="t('matches.date')">
        @for (day of days(); track day) {
          <button type="button" role="tab" [attr.aria-selected]="day === date()" [class.active]="day === date()" (click)="setDay(day)">
            {{ dayLabel(day) }}
          </button>
        }
      </div>
      @if (can()('tournament.update')) {
        <p-button [label]="t('matches.schedule.courts')" icon="pi pi-th-large" severity="secondary" [outlined]="true" (onClick)="openCourts()" />
      }
    </section>

    @if (board.value(); as b) {
      <div class="layout">
        <aside class="tb-card pool" (dragover)="$event.preventDefault()">
          <h3>{{ t('matches.schedule.unscheduled') }} <span class="count">{{ b.unscheduled.length }}</span></h3>
          @if (canSchedule()) {
            <p class="tb-muted hint">{{ t('matches.schedule.dropHint') }}</p>
          }
          <ul>
            @for (m of b.unscheduled; track m.id) {
              <li>
                <!-- A div, not a button: Chrome doesn't start drags from buttons. -->
                <div role="button" tabindex="0" class="card pool-card" [attr.data-status]="m.status" [attr.draggable]="canSchedule()" (dragstart)="drag($event, m)" (click)="open(m.id)" (keydown.enter)="open(m.id)" (keydown.space)="$event.preventDefault(); open(m.id)">
                  <small>{{ m.event.name }} · {{ roundText(m) }}</small>
                  <span>{{ name(m, 1) }}</span>
                  <span>{{ name(m, 2) }}</span>
                </div>
              </li>
            } @empty {
              <li class="tb-muted small">{{ t('matches.schedule.none') }}</li>
            }
          </ul>
        </aside>

        @if (b.courts.length) {
          <div class="tb-card timeline" [style.--rows]="rows()">
            <div class="times" aria-hidden="true">
              <div class="corner"></div>
              @for (slot of slots(); track slot) {
                <div class="time">{{ slot % 60 === 0 ? hhmm(slot) : '' }}</div>
              }
            </div>
            @for (court of b.courts; track court.id) {
              <div class="court">
                <div class="court-head">
                  <strong>{{ court.name }}</strong>
                  <small class="tb-muted">{{ court.club.name }}</small>
                </div>
                <div
                  class="lane"
                  [class.drop]="dropCourt() === court.id"
                  (dragover)="over($event, court.id)"
                  (dragleave)="dropCourt.set(null)"
                  (drop)="drop($event, court.id)"
                >
                  @for (closed of closedBlocks(court.windows); track $index) {
                    <div class="block closed" [style.top.px]="top(closed.from)" [style.height.px]="height(closed.from, closed.to)"><span>{{ t('matches.schedule.closed') }}</span></div>
                  }
                  @for (bk of bookingsOf(court.id); track $index) {
                    <div class="block busy" [style.top.px]="top(bk.from)" [style.height.px]="height(bk.from, bk.to)" [title]="bk.label"><span>{{ bk.kind }} · {{ bk.label }}</span></div>
                  }
                  @for (m of matchesOf(court.id); track m.id) {
                    <div
                      role="button"
                      tabindex="0"
                      class="card match"
                      [attr.data-status]="m.status"
                      [style.top.px]="top(minuteOfDay(m.scheduledAt!))"
                      [style.height.px]="height(minuteOfDay(m.scheduledAt!), minuteOfDay(m.scheduledAt!) + m.event.matchDurationMinutes)"
                      [attr.draggable]="canSchedule() && m.status !== 'LIVE' && m.status !== 'COMPLETED'"
                      (dragstart)="drag($event, m)"
                      (click)="open(m.id)"
                      (keydown.enter)="open(m.id)"
                    >
                      <small>{{ m.scheduledAt | tbDate: 'time' }} · {{ m.event.name }}</small>
                      <span [class.won]="m.winnerSide === 1">{{ name(m, 1) }}</span>
                      <span [class.won]="m.winnerSide === 2">{{ name(m, 2) }}</span>
                      @if (m.score) {
                        <small class="score">{{ m.score }}</small>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="tb-card"><tb-empty-state [message]="t('matches.schedule.noCourts')" icon="pi pi-th-large" /></div>
        }
      </div>
    } @else {
      <p-skeleton height="480px" borderRadius="14px" />
    }

    <tb-match-drawer [matchId]="selected()" (closed)="open(null)" (changed)="board.reload(); changed.emit()" />

    <p-dialog [(visible)]="courtsOpen" [modal]="true" [header]="t('matches.schedule.courts')" [style]="{ width: 'min(480px, 94vw)' }" [draggable]="false">
      <p class="tb-muted small">{{ t('matches.schedule.courtsHint') }}</p>
      @for (c of courtOptions.value()?.courts ?? []; track c.id) {
        <label class="court-option">
          <p-checkbox [binary]="true" [ngModel]="chosen().has(c.id)" (ngModelChange)="toggleCourt(c.id, $event)" [inputId]="'co-' + c.id" />
          <span>{{ c.name }}</span>
          <small class="tb-muted">{{ c.club.name }}</small>
        </label>
      }
      <ng-template #footer>
        <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="courtsOpen.set(false)" />
        <p-button [label]="t('matches.schedule.saveCourts')" icon="pi pi-check" [loading]="savingCourts()" (onClick)="saveCourts()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); --lane: 190px; }
    .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--tb-space-3); padding: var(--tb-space-3) var(--tb-space-4); }
    .days { display: flex; flex-wrap: wrap; gap: var(--tb-space-1); }
    .days button { border: 1px solid var(--tb-border); background: var(--tb-surface); border-radius: var(--tb-radius-full); padding: 4px 14px; font: inherit; font-size: var(--tb-text-sm); cursor: pointer; color: var(--tb-text-muted); }
    .days button.active { background: var(--tb-primary-600); border-color: var(--tb-primary-600); color: #fff; }
    .days button:focus-visible { outline: 2px solid var(--tb-primary-500); outline-offset: 2px; }
    .layout { display: grid; grid-template-columns: 250px 1fr; gap: var(--tb-space-4); align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .pool { padding: var(--tb-space-3); max-height: 75vh; overflow: auto; }
    .pool h3 { font-size: var(--tb-text-sm); margin: 0 0 var(--tb-space-2); display: flex; justify-content: space-between; }
    .pool ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--tb-space-2); }
    .count { color: var(--tb-text-muted); }
    .hint, .small { font-size: var(--tb-text-xs); margin: 0 0 var(--tb-space-2); }
    .card { all: unset; box-sizing: border-box; display: grid; gap: 1px; width: 100%; padding: 6px 8px; border-radius: var(--tb-radius-sm); background: var(--tb-surface); border: 1px solid var(--tb-border); border-left: 4px solid var(--tb-primary-400); font-size: var(--tb-text-xs); cursor: pointer; overflow: hidden; }
    .card small { color: var(--tb-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--tb-text-sm); }
    /* all: unset drops the browser's own drag style for draggable elements. */
    .card[draggable='true'] { cursor: grab; -webkit-user-drag: element; }
    .card:focus-visible { outline: 2px solid var(--tb-primary-500); outline-offset: 1px; }
    .card[data-status='PENDING'] { border-left-color: var(--tb-border-strong); }
    .card[data-status='LIVE'] { border-left-color: var(--tb-accent-500); background: var(--tb-tone-warning-bg); }
    .card[data-status='COMPLETED'] { border-left-color: var(--tb-tone-success-fg); }
    .card[data-status='POSTPONED'] { border-left-color: var(--tb-tone-danger-fg); }
    .card .won { font-weight: var(--tb-weight-bold); }
    .card .score { color: var(--tb-text); font-variant-numeric: tabular-nums; }
    .timeline { display: flex; padding: 0; overflow: auto; max-height: 75vh; }
    .times { flex: none; width: 52px; border-right: 1px solid var(--tb-border); position: sticky; left: 0; background: var(--tb-surface); z-index: 3; }
    .corner, .court-head { height: 52px; position: sticky; top: 0; background: var(--tb-surface); z-index: 2; border-bottom: 1px solid var(--tb-border); }
    .time { height: ${ROW}px; font-size: 11px; color: var(--tb-text-muted); text-align: right; padding-right: 6px; transform: translateY(-7px); font-variant-numeric: tabular-nums; }
    .court { flex: 0 0 var(--lane); border-right: 1px solid var(--tb-border); }
    .court-head { display: grid; align-content: center; padding: 0 var(--tb-space-2); }
    .court-head strong { font-size: var(--tb-text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .court-head small { font-size: 11px; }
    .lane { position: relative; height: calc(var(--rows) * ${ROW}px); background-image: repeating-linear-gradient(to bottom, transparent 0 ${ROW - 1}px, var(--tb-border) ${ROW - 1}px ${ROW}px); }
    .lane.drop { background-color: var(--tb-primary-50); }
    .lane .match { position: absolute; left: 4px; right: 4px; z-index: 1; }
    .block { position: absolute; left: 0; right: 0; font-size: 11px; padding: 2px 6px; overflow: hidden; color: var(--tb-text-muted); }
    .block span { white-space: nowrap; }
    .closed { background: repeating-linear-gradient(135deg, var(--tb-surface-muted) 0 6px, transparent 6px 12px); }
    .busy { left: 4px; right: 4px; border-radius: var(--tb-radius-sm); background: var(--tb-tone-neutral-bg); border: 1px dashed var(--tb-border-strong); }
    .court-option { display: flex; align-items: center; gap: var(--tb-space-2); padding: var(--tb-space-2) 0; cursor: pointer; }
    .court-option small { margin-left: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleBoard {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(TournamentApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(MessageService);
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);

  readonly tournament = input.required<TournamentDetail>();
  readonly can = input.required<TournamentCan>();
  readonly changed = output<void>();

  protected readonly hhmm = hhmm;
  protected readonly minuteOfDay = minuteOfDay;

  protected readonly days = computed(() => {
    const out: string[] = [];
    const end = new Date(this.tournament().endDate);
    for (let d = new Date(this.tournament().startDate); d <= end; d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
    return out;
  });
  /** ?day=, else today when the tournament is on, else its first day. */
  protected readonly date = computed(() => {
    const wanted = this.params()?.get('day');
    const today = new Date().toISOString().slice(0, 10);
    const days = this.days();
    return days.includes(wanted ?? '') ? wanted! : days.includes(today) ? today : days[0];
  });
  protected readonly selected = computed(() => this.params()?.get('match') ?? null);
  protected readonly board = resource({
    params: () => ({ id: this.tournament().id, date: this.date() }),
    loader: ({ params }) => this.api.schedule(params.id, params.date),
  });
  protected readonly canSchedule = computed(() => this.can()('match.schedule'));

  /** Grid range: earliest opening to latest closing of the courts (08:00–22:00 by default). */
  private readonly range = computed(() => {
    const windows = (this.board.value()?.courts ?? []).flatMap((c) => c.windows);
    const from = windows.length ? Math.min(...windows.map((w) => minutes(w.opensAt))) : 8 * 60;
    const to = windows.length ? Math.max(...windows.map((w) => minutes(w.closesAt))) : 22 * 60;
    return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
  });
  protected readonly rows = computed(() => (this.range().to - this.range().from) / STEP);
  protected readonly slots = computed(() => Array.from({ length: this.rows() }, (_, i) => this.range().from + i * STEP));
  protected readonly dropCourt = signal<string | null>(null);

  protected top(minute: number) {
    return ((minute - this.range().from) / STEP) * ROW;
  }

  protected height(from: number, to: number) {
    return Math.max(ROW / 2, ((Math.min(to, this.range().to) - from) / STEP) * ROW - 2);
  }

  protected closedBlocks(windows: { opensAt: string; closesAt: string }[]) {
    const open = windows.map((w) => ({ from: minutes(w.opensAt), to: minutes(w.closesAt) })).sort((a, b) => a.from - b.from);
    const blocks: { from: number; to: number }[] = [];
    let cursor = this.range().from;
    for (const w of open) {
      if (w.from > cursor) blocks.push({ from: cursor, to: w.from });
      cursor = Math.max(cursor, w.to);
    }
    if (cursor < this.range().to) blocks.push({ from: cursor, to: this.range().to });
    return blocks;
  }

  protected matchesOf(courtId: string) {
    return (this.board.value()?.matches ?? []).filter((m) => m.court?.id === courtId && m.scheduledAt);
  }

  protected bookingsOf(courtId: string) {
    const b = this.board.value();
    if (!b) return [];
    return [
      ...b.bookings.filter((x) => x.courtId === courtId).map((x) => ({ from: minuteOfDay(x.start), to: minuteOfDay(x.end), label: x.label, kind: this.t('matches.schedule.booking') })),
      ...b.otherMatches.filter((x) => x.courtId === courtId).map((x) => ({ from: minuteOfDay(x.start), to: minuteOfDay(x.end), label: x.label, kind: this.t('matches.schedule.otherTournament') })),
    ];
  }

  protected name(m: TournamentMatch, side: 1 | 2) {
    return sideName(side === 1 ? m.side1 : m.side2) || this.t('matches.tbd');
  }

  protected roundText(m: TournamentMatch) {
    if (!m.round.rounds) return m.round.name;
    const r = roundLabel(m.round.number, m.round.rounds);
    return this.t(r.key, r.params);
  }

  protected dayLabel(day: string) {
    return formatDate(`${day}T12:00:00Z`, this.i18n.lang(), 'date');
  }

  protected setDay(day: string) {
    void this.router.navigate([], { queryParams: { day }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected open(id: string | null) {
    void this.router.navigate([], { queryParams: { match: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // Drag and drop ------------------------------------------------------------

  protected drag(event: DragEvent, m: TournamentMatch) {
    if (!this.canSchedule()) return;
    event.dataTransfer?.setData('text/plain', m.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected over(event: DragEvent, courtId: string) {
    if (!this.canSchedule()) return;
    event.preventDefault();
    this.dropCourt.set(courtId);
  }

  protected async drop(event: DragEvent, courtId: string) {
    event.preventDefault();
    this.dropCourt.set(null);
    const id = event.dataTransfer?.getData('text/plain');
    if (!id) return;
    const lane = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const minute = this.range().from + Math.round(((event.clientY - lane.top) / ROW) * STEP / SNAP) * SNAP;
    const iso = `${this.date()}T${hhmm(Math.max(this.range().from, minute))}:00Z`;
    try {
      await this.api.scheduleMatch(id, iso, courtId);
      this.toasts.add({ severity: 'success', summary: this.t('matches.schedule.moved'), detail: formatDate(iso, this.i18n.lang(), 'slot') });
      this.board.reload();
      this.changed.emit();
    } catch (raw) {
      const error = ApiError.from(raw);
      const conflicts = error.code === 'SCHEDULE_CONFLICT' ? (error.issues as ScheduleConflict[]) : [];
      this.toasts.add({
        severity: 'error',
        summary: describeError(error, this.t),
        detail: conflicts.map((c) => `${this.t('matches.drawer.conflictTypes.' + c.type)} · ${c.label}`).join(' — ') || undefined,
        life: 6000,
      });
    }
  }

  // Courts of the tournament ------------------------------------------------

  protected readonly courtsOpen = signal(false);
  protected readonly courtOptions = resource({
    params: () => (this.courtsOpen() ? this.tournament().id : undefined),
    loader: ({ params }) => this.api.courtOptions(params),
  });
  protected readonly chosenOverride = signal<Set<string> | null>(null);
  protected readonly chosen = computed(() => {
    const override = this.chosenOverride();
    if (override) return override;
    const options = this.courtOptions.value();
    if (!options) return new Set<string>();
    return new Set(options.courts.filter((c) => (options.usesVenueDefault ? true : c.chosen)).map((c) => c.id));
  });
  protected readonly savingCourts = signal(false);

  protected openCourts() {
    this.chosenOverride.set(null);
    this.courtsOpen.set(true);
  }

  protected toggleCourt(id: string, on: boolean) {
    const next = new Set(this.chosen());
    if (on) next.add(id);
    else next.delete(id);
    this.chosenOverride.set(next);
  }

  protected async saveCourts() {
    this.savingCourts.set(true);
    try {
      await this.api.setCourts(this.tournament().id, [...this.chosen()]);
      this.toasts.add({ severity: 'success', summary: this.t('matches.schedule.courtsSaved') });
      this.courtsOpen.set(false);
      this.board.reload();
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.savingCourts.set(false);
    }
  }
}
