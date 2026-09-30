import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { download } from '../club/club.api';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { InsightsApi } from './insights.api';

/** /federations/:id/rankings — federation players by season points from tournaments. */
@Component({
  selector: 'tb-rankings-page',
  imports: [FormsModule, ButtonModule, SelectModule, TableModule, EmptyState, UserCell, PageHeader, SearchInput],
  template: `
    <tb-page-header [title]="t('rankings.title')" [subtitle]="t('rankings.subtitle')">
      <p-button [label]="t('rankings.export')" icon="pi pi-download" severity="secondary" [outlined]="true" [loading]="exporting()" (onClick)="export()" />
    </tb-page-header>
    <p class="tb-muted hint"><i class="pi pi-info-circle" aria-hidden="true"></i> {{ t('rankings.hint') }}</p>
    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="q()" [placeholder]="t('rankings.searchPlaceholder')" (search)="q.set($event); first.set(0)" />
        <p-select [options]="seasons" [ngModel]="season()" (ngModelChange)="season.set($event); first.set(0)" [attr.aria-label]="t('rankings.season')" />
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table [value]="page()?.items ?? []" [lazy]="true" [loading]="data.isLoading()" [paginator]="(page()?.total ?? 0) > rows" [rows]="rows" [first]="first()" [totalRecords]="page()?.total ?? 0" (onLazyLoad)="onPage($event)" dataKey="userId" styleClass="tb-table">
        <ng-template #header>
          <tr>
            <th class="num">{{ t('rankings.columns.rank') }}</th>
            <th>{{ t('rankings.columns.player') }}</th>
            <th>{{ t('rankings.columns.classification') }}</th>
            <th>{{ t('rankings.columns.clubs') }}</th>
            <th class="num">{{ t('rankings.columns.points') }}</th>
            <th class="num">{{ t('rankings.columns.record') }}</th>
            <th>{{ t('rankings.columns.form') }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-r>
          <tr>
            <td class="num rank" [class.podium]="r.rank <= 3">{{ r.rank }}</td>
            <td><tb-user-cell [firstname]="r.firstname" [lastname]="r.lastname" /></td>
            <td class="mono">{{ r.classification ?? 'NC' }}</td>
            <td class="tb-muted">{{ r.clubs.join(', ') }}</td>
            <td class="num strong">{{ r.points }}</td>
            <td class="num">{{ r.wins }} – {{ r.losses }}</td>
            <td>
              <span class="form">
                @for (f of r.form; track $index) {
                  <span [class]="f === 'WIN' ? 'w' : 'l'" [attr.aria-label]="f">{{ f === 'WIN' ? 'V' : 'D' }}</span>
                }
              </span>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7"><tb-empty-state [message]="t('list.empty')" icon="pi pi-sort-amount-down" /></td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    .hint { display: flex; gap: var(--tb-space-2); align-items: center; margin: calc(-1 * var(--tb-space-4)) 0 var(--tb-space-5); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .rank { font-weight: var(--tb-weight-semibold); width: 56px; }
    .rank.podium { color: var(--tb-primary-700); }
    .strong { font-weight: var(--tb-weight-bold); }
    .form { display: inline-flex; gap: 3px; }
    .form span { width: 20px; height: 20px; border-radius: 4px; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .form .w { background: var(--tb-tone-success-bg); color: var(--tb-tone-success-fg); }
    .form .l { background: var(--tb-tone-danger-bg); color: var(--tb-tone-danger-fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingsPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(InsightsApi);
  private readonly toasts = inject(MessageService);

  readonly id = input.required<string>();
  protected readonly rows = 50;
  private readonly year = new Date().getFullYear();
  protected readonly seasons = [this.year, this.year - 1, this.year - 2].map((y) => ({ label: String(y), value: y }));
  protected readonly season = signal(this.year);
  protected readonly q = signal('');
  protected readonly first = signal(0);
  protected readonly exporting = signal(false);

  protected readonly data = resource({
    params: () => ({ id: this.id(), season: this.season(), q: this.q(), page: Math.floor(this.first() / this.rows) + 1 }),
    loader: ({ params }) => this.api.rankings(params.id, params.season, params.q, params.page, this.rows),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.data.value>, ReturnType<typeof this.data.value>>({
    source: () => this.data.value(),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly total = computed(() => this.page()?.total ?? 0);

  protected onPage(event: TableLazyLoadEvent) {
    if ((event.first ?? 0) !== this.first()) this.first.set(event.first ?? 0);
  }

  protected async export() {
    this.exporting.set(true);
    try {
      download(await this.api.rankingsCsv(this.id(), this.season()), `ranking-${this.season()}.csv`);
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.exporting.set(false);
    }
  }
}
