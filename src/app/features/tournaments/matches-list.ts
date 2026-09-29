import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { MatchDrawer } from './match-drawer';
import { TournamentApi } from './tournament.api';
import { MATCH_STATUSES, roundLabel, sideName, type TournamentMatch } from './tournament.models';

const RESULT_STATUSES = ['ENTERED', 'VALIDATED', 'DISPUTED'];

/** Tournament matches with filters; a row opens the match drawer (?match=). */
@Component({
  selector: 'tb-matches-list',
  imports: [FormsModule, ButtonModule, DatePickerModule, SelectModule, TableModule, ToggleSwitchModule, EmptyState, SearchInput, StatusBadge, TbDatePipe, MatchDrawer],
  template: `
    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('matches.searchPlaceholder')" (search)="list.update({ q: $event })" />
        @if (!competitionId()) {
          <p-select [options]="tournamentOptions()" [ngModel]="list.query().filters['competitionId'] ?? null" (ngModelChange)="list.update({ competitionId: $event })" [placeholder]="t('matches.tournament')" [showClear]="true" [filter]="true" [attr.aria-label]="t('matches.tournament')" />
        }
        <p-select [options]="statusOptions()" [ngModel]="list.query().filters['status'] ?? null" (ngModelChange)="list.update({ status: $event })" [placeholder]="t('matches.status')" [showClear]="true" [attr.aria-label]="t('matches.status')" />
        <p-select [options]="resultOptions()" [ngModel]="list.query().filters['resultStatus'] ?? null" (ngModelChange)="list.update({ resultStatus: $event })" [placeholder]="t('matches.result')" [showClear]="true" [attr.aria-label]="t('matches.result')" />
        <p-datepicker [ngModel]="day()" (ngModelChange)="setDay($event)" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true" [placeholder]="t('matches.date')" [attr.aria-label]="t('matches.date')" appendTo="body" />
        <label class="mine">
          <p-toggleswitch [ngModel]="list.query().filters['mine'] === 'true'" (ngModelChange)="list.update({ mine: $event ? 'true' : null })" />
          <span>{{ t('matches.mine') }}</span>
        </label>
        @if (list.hasFilters()) {
          <p-button [label]="t('list.clearFilters')" [text]="true" severity="secondary" icon="pi pi-filter-slash" (onClick)="list.clearFilters()" />
        }
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table
        [value]="page()?.items ?? []"
        [lazy]="true"
        [loading]="matches.isLoading()"
        [paginator]="true"
        [rows]="list.query().pageSize"
        [first]="list.first()"
        [totalRecords]="page()?.total ?? 0"
        [rowsPerPageOptions]="[20, 50, 100]"
        (onLazyLoad)="list.onLazyLoad($event)"
        dataKey="id"
        [rowHover]="true"
        styleClass="tb-table"
      >
        <ng-template #header>
          <tr>
            <th>{{ t('matches.columns.when') }}</th>
            <th>{{ t('matches.columns.match') }}</th>
            <th>{{ t('matches.columns.players') }}</th>
            <th>{{ t('matches.columns.score') }}</th>
            <th>{{ t('matches.columns.status') }}</th>
            <th>{{ t('matches.columns.official') }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-m>
          <tr class="clickable" (click)="open(m.id)" (keydown.enter)="open(m.id)" tabindex="0">
            <td>
              <div class="when">
                @if (m.scheduledAt) {
                  <strong>{{ m.scheduledAt | tbDate: 'slot' }}</strong>
                  <small class="tb-muted">{{ m.court?.name }}</small>
                } @else {
                  <span class="tb-muted">{{ t('matches.unscheduled') }}</span>
                }
              </div>
            </td>
            <td>
              <span>{{ m.event.name }}</span>
              <small class="tb-muted block">{{ roundText(m) }}@if (!competitionId()) { · {{ m.competition.name }} }</small>
            </td>
            <td>
              <div class="players">
                <span [class.won]="m.winnerSide === 1">{{ name(m, 1) }}</span>
                <span [class.won]="m.winnerSide === 2">{{ name(m, 2) }}</span>
              </div>
            </td>
            <td class="mono">{{ m.outcome === 'WALKOVER' ? t('matches.walkover') : m.score }}{{ m.outcome === 'RETIRED' ? ' ab.' : '' }}</td>
            <td>
              <div class="badges">
                <tb-status-badge kind="match" [value]="m.status" />
                @if (m.resultStatus === 'ENTERED' || m.resultStatus === 'DISPUTED') {
                  <tb-status-badge kind="result" [value]="m.resultStatus" />
                }
              </div>
            </td>
            <td class="tb-muted">{{ m.official ? m.official.firstname + ' ' + m.official.lastname : '—' }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="6"><tb-empty-state [message]="list.hasFilters() ? t('list.emptyFiltered') : t('list.empty')" icon="pi pi-stopwatch" /></td></tr>
        </ng-template>
      </p-table>
    </div>
    <tb-match-drawer [matchId]="selected()" (closed)="open(null)" (changed)="matches.reload(); changed.emit()" />
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    .mine { display: inline-flex; align-items: center; gap: var(--tb-space-2); font-size: var(--tb-text-sm); cursor: pointer; }
    .when { display: grid; white-space: nowrap; }
    .block { display: block; }
    .players { display: grid; gap: 2px; min-width: 200px; }
    .players .won { font-weight: var(--tb-weight-bold); }
    .badges { display: flex; flex-wrap: wrap; gap: 4px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesList {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly router = inject(Router);

  /** Fixed tournament (tournament page), else a filter. */
  readonly competitionId = input<string | null>(null);
  /** A change was made from the drawer. */
  readonly changed = output<void>();

  protected readonly list = injectListQuery(['competitionId', 'status', 'resultStatus', 'date', 'mine'], { pageSize: 50 });
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);
  private readonly apiQuery = computed(() => {
    const q = this.list.query();
    return { ...q, filters: { ...q.filters, competitionId: this.competitionId() ?? q.filters['competitionId'] } };
  });
  protected readonly matches = resource({ params: () => this.apiQuery(), loader: ({ params }) => this.api.matches(params) });
  protected readonly page = linkedSignal<ReturnType<typeof this.matches.value>, ReturnType<typeof this.matches.value>>({
    source: () => this.matches.value(),
    computation: (value, previous) => value ?? previous?.value,
  });
  private readonly tournaments = resource({
    params: () => (this.competitionId() ? undefined : true),
    loader: () => this.api.list({ page: 1, pageSize: 100, sort: 'startDate:desc', filters: {} }),
  });
  protected readonly tournamentOptions = computed(() => (this.tournaments.value()?.items ?? []).map((c) => ({ label: c.name, value: c.id })));
  protected readonly statusOptions = computed(() => MATCH_STATUSES.map((s) => ({ label: this.t(`status.match.${s}`), value: s })));
  protected readonly resultOptions = computed(() => RESULT_STATUSES.map((s) => ({ label: this.t(`status.result.${s}`), value: s })));
  /** The match open in the drawer (?match=). */
  protected readonly selected = computed(() => this.params()?.get('match') ?? null);
  protected readonly day = computed(() => {
    const d = this.list.query().filters['date'];
    return d ? new Date(`${d}T00:00:00`) : null;
  });

  protected setDay(date: Date | null) {
    const iso = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;
    void this.list.update({ date: iso });
  }

  protected name(m: TournamentMatch, side: 1 | 2) {
    return sideName(side === 1 ? m.side1 : m.side2) || this.t('matches.tbd');
  }

  protected roundText(m: TournamentMatch) {
    if (!m.round.rounds) return m.round.name;
    const r = roundLabel(m.round.number, m.round.rounds);
    return this.t(r.key, r.params);
  }

  protected open(id: string | null) {
    void this.router.navigate([], { queryParams: { match: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
