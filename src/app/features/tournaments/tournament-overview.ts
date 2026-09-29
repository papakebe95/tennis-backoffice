import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { auditActionLabel, TbAgoPipe, TbDatePipe } from '../../shared/format';
import { KpiCard } from '../../shared/ui/bits';
import { StatusBadge } from '../../shared/ui/status-badge';
import type { TournamentDetail, TournamentEvent, TournamentStatus } from './tournament.models';

const STAGES: TournamentStatus[] = ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'];

/** Tables ordered along their qualification chains: lowest table first. */
export function tableChains(events: readonly TournamentEvent[]): TournamentEvent[][] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const fed = new Set(events.map((e) => e.qualifiesIntoEventId).filter((id): id is string => !!id));
  const chains: TournamentEvent[][] = [];
  const placed = new Set<string>();
  for (const root of events.filter((e) => !fed.has(e.id))) {
    const chain: TournamentEvent[] = [];
    for (let e: TournamentEvent | undefined = root; e && !placed.has(e.id); e = e.qualifiesIntoEventId ? byId.get(e.qualifiesIntoEventId) : undefined) {
      chain.push(e);
      placed.add(e.id);
    }
    chains.push(chain);
  }
  // A table fed by two chains is shown in the first; anything left (loops) alone.
  for (const e of events) if (!placed.has(e.id)) chains.push([e]);
  return chains;
}

@Component({
  selector: 'tb-tournament-overview',
  imports: [KpiCard, StatusBadge, TbDatePipe, TbAgoPipe],
  template: `
    @let d = tournament();
    <section class="kpis">
      <tb-kpi-card [label]="t('tournaments.kpi.entries')" [value]="d.stats.entries.APPROVED" icon="pi pi-check-circle" />
      <tb-kpi-card [label]="t('tournaments.kpi.pending')" [value]="d.stats.entries.PENDING" icon="pi pi-inbox" [link]="'/tournaments/' + d.id + '/registrations'" />
      <tb-kpi-card [label]="t('tournaments.kpi.waitlisted')" [value]="d.stats.entries.WAITLISTED" icon="pi pi-hourglass" />
      <tb-kpi-card [label]="t('tournaments.kpi.players')" [value]="d.stats.players" icon="pi pi-users" />
      <tb-kpi-card [label]="t('tournaments.kpi.tables')" [value]="d.events.length" icon="pi pi-sitemap" [link]="'/tournaments/' + d.id + '/tables'" />
      <tb-kpi-card [label]="t('tournaments.kpi.staff')" [value]="d.stats.staff" icon="pi pi-id-card" [link]="'/tournaments/' + d.id + '/team'" />
    </section>

    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('tournaments.lifecycle.steps') }}</h2>
      <ol class="stages">
        @for (stage of stages; track stage; let i = $index) {
          <li [class.done]="stageIndex() > i" [class.current]="stageIndex() === i" [class.off]="offTrack()">
            <span class="dot" aria-hidden="true">{{ stageIndex() > i ? '✓' : '' }}</span>
            <span>{{ t('status.tournament.' + stage) }}</span>
          </li>
        }
      </ol>
      @if (offTrack()) {
        <p class="off-note"><tb-status-badge kind="tournament" [value]="d.status" /></p>
      }
    </section>

    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('tournaments.chain.title') }}</h2>
      <p class="tb-muted hint">{{ t('tournaments.chain.hint') }}</p>
      <div class="chains">
        @for (chain of chains(); track $index) {
          <div class="chain">
            @for (e of chain; track e.id; let last = $last) {
              <article class="table">
                <strong>{{ e.name }}</strong>
                <span class="tb-muted window">{{ windowText(e) }}</span>
                <div class="fill" [attr.aria-label]="placesText(e)">
                  <div class="bar"><span [style.width.%]="fillPercent(e)"></span></div>
                  <small class="tb-muted">{{ placesText(e) }}</small>
                </div>
                <tb-status-badge kind="draw" [value]="e.drawStatus" />
              </article>
              @if (!last && e.qualifiesIntoEventId) {
                <div class="arrow" aria-hidden="true">
                  <i class="pi pi-arrow-right"></i>
                  <small>{{ t('tournaments.chain.qualifiers', { count: e.qualifierCount }) }}</small>
                </div>
              }
            }
          </div>
        }
      </div>
    </section>

    <div class="grid">
      <section class="tb-card">
        <h2 class="tb-card-title">{{ t('tournaments.activity.title') }}</h2>
        <ul class="feed">
          @for (a of d.activity; track a.id) {
            <li>
              <span>{{ label(a.action) }}</span>
              <small class="tb-muted">{{ a.actor ? a.actor.firstname + ' ' + a.actor.lastname : t('audit.system') }} · {{ a.createdAt | tbAgo }}</small>
              @if (a.reason) {
                <small class="reason">« {{ a.reason }} »</small>
              }
            </li>
          } @empty {
            <li class="tb-muted">{{ t('tournaments.activity.empty') }}</li>
          }
        </ul>
      </section>

      @if (d.interruptions.length) {
        <section class="tb-card">
          <h2 class="tb-card-title">{{ t('tournaments.interruption.history') }}</h2>
          <ul class="feed">
            @for (i of d.interruptions; track i.id) {
              <li>
                <span>{{ t('tournaments.interruptionReasons.' + i.reason) }}{{ i.note ? ' — ' + i.note : '' }}</span>
                <small class="tb-muted">
                  {{ i.startedAt | tbDate }} ·
                  {{ i.resumedAt ? t('tournaments.interruption.resumedAt', { date: (i.resumedAt | tbDate) }) : t('tournaments.interruption.ongoing') }}
                </small>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-5); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: var(--tb-space-4); }
    .stages { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--tb-space-2); }
    .stages li { display: grid; justify-items: center; gap: var(--tb-space-2); text-align: center; font-size: var(--tb-text-sm); color: var(--tb-text-muted); position: relative; }
    .stages li::before { content: ''; position: absolute; top: 13px; left: -50%; right: 50%; height: 2px; background: var(--tb-border); z-index: 0; }
    .stages li:first-child::before { display: none; }
    .stages li.done::before, .stages li.current::before { background: var(--tb-primary-500); }
    .stages .dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--tb-surface); border: 2px solid var(--tb-border); z-index: 1; font-size: var(--tb-text-xs); color: #fff; }
    .stages li.done .dot { background: var(--tb-primary-500); border-color: var(--tb-primary-500); }
    .stages li.current .dot { border-color: var(--tb-primary-600); box-shadow: 0 0 0 4px var(--tb-primary-100); }
    .stages li.current { color: var(--tb-text); font-weight: var(--tb-weight-semibold); }
    .stages li.off { opacity: 0.55; }
    .off-note { margin: var(--tb-space-3) 0 0; }
    @media (max-width: 640px) { .stages { grid-template-columns: 1fr; } .stages li::before { display: none; } .stages li { justify-items: start; grid-auto-flow: column; justify-content: start; } }
    .hint { margin: calc(-1 * var(--tb-space-2)) 0 var(--tb-space-4); font-size: var(--tb-text-sm); }
    .chains { display: grid; gap: var(--tb-space-4); }
    .chain { display: flex; align-items: stretch; gap: var(--tb-space-2); overflow-x: auto; padding-bottom: var(--tb-space-1); }
    .table { flex: 0 0 220px; display: grid; gap: var(--tb-space-2); align-content: start; padding: var(--tb-space-3) var(--tb-space-4); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); background: var(--tb-surface); }
    .window { font-size: var(--tb-text-sm); }
    .bar { height: 6px; border-radius: 3px; background: var(--tb-surface-muted); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--tb-primary-500); border-radius: 3px; }
    .arrow { flex: none; display: grid; place-items: center; align-content: center; gap: 4px; color: var(--tb-primary-700); padding: 0 var(--tb-space-1); }
    .arrow small { font-size: var(--tb-text-xs); white-space: nowrap; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--tb-space-5); align-items: start; }
    .feed { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--tb-space-3); }
    .feed li { display: grid; gap: 2px; }
    .reason { color: var(--tb-text-muted); font-style: italic; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentOverview {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  readonly tournament = input.required<TournamentDetail>();

  protected readonly stages = STAGES;
  protected readonly offTrack = computed(() => ['CANCELLED', 'INTERRUPTED'].includes(this.tournament().status));
  protected readonly stageIndex = computed(() => {
    const status = this.tournament().status;
    return status === 'INTERRUPTED' ? STAGES.indexOf('IN_PROGRESS') : STAGES.indexOf(status);
  });
  protected readonly chains = computed(() => tableChains(this.tournament().events));

  protected label(action: string) {
    return auditActionLabel(this.i18n, action);
  }

  protected windowText(e: TournamentEvent) {
    const weakest = e.minClassification?.code;
    const strongest = e.maxClassification?.code;
    const window = weakest && strongest
      ? this.t('tournaments.tables.windowRange', { weakest, strongest })
      : strongest
        ? this.t('tournaments.tables.atMost', { code: strongest })
        : weakest
          ? this.t('tournaments.tables.atLeast', { code: weakest })
          : this.t('tournaments.tables.anyClassification');
    return `${this.t('tournaments.genders.' + e.gender)} · ${window}`;
  }

  protected placesText(e: TournamentEvent) {
    return e.maxEntries
      ? this.t('tournaments.tables.places', { count: e.entries.APPROVED, max: e.maxEntries })
      : this.t('tournaments.tables.entriesOnly', { count: e.entries.APPROVED });
  }

  protected fillPercent(e: TournamentEvent) {
    return e.maxEntries ? Math.min(100, (e.entries.APPROVED / e.maxEntries) * 100) : 0;
  }
}
