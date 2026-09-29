import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe } from '../../shared/format';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ClubApi } from './club.api';

/** /federations/:id/players — current members of affiliated clubs. */
@Component({
  selector: 'tb-federation-players-page',
  imports: [FormsModule, SelectModule, TableModule, PageHeader, SearchInput, StatusBadge, EmptyState, UserCell, TbDatePipe],
  template: `
    <tb-page-header [title]="t('fedPlayers.title')" [subtitle]="t('fedPlayers.subtitle')" />
    <p class="tb-muted hint"><i class="pi pi-info-circle" aria-hidden="true"></i> {{ t('fedPlayers.hint') }}</p>
    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('fedPlayers.searchPlaceholder')" (search)="list.update({ q: $event })" />
        <p-select [options]="clubOptions()" [ngModel]="list.query().filters['clubId'] ?? null" (ngModelChange)="list.update({ clubId: $event })" [placeholder]="t('fedPlayers.club')" [showClear]="true" />
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table [value]="page()?.items ?? []" [lazy]="true" [loading]="players.isLoading()" [paginator]="(page()?.total ?? 0) > list.query().pageSize" [rows]="list.query().pageSize" [first]="list.first()" [totalRecords]="page()?.total ?? 0" (onLazyLoad)="list.onLazyLoad($event)" dataKey="id" styleClass="tb-table">
        <ng-template #header>
          <tr>
            <th>{{ t('fedPlayers.columns.player') }}</th>
            <th>{{ t('fedPlayers.columns.club') }}</th>
            <th>{{ t('fedPlayers.columns.number') }}</th>
            <th>{{ t('fedPlayers.columns.level') }}</th>
            <th>{{ t('fedPlayers.columns.rating') }}</th>
            <th>{{ t('fedPlayers.columns.until') }}</th>
            <th>{{ t('fedPlayers.columns.status') }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-p>
          <tr>
            <td><tb-user-cell [firstname]="p.firstname" [lastname]="p.lastname" [secondary]="p.msisdn" /></td>
            <td>
              @for (m of p.clubMemberships; track m.club.id) {
                <div>{{ m.club.name }}</div>
              }
            </td>
            <td class="mono">
              @for (m of p.clubMemberships; track m.club.id) {
                <div>{{ m.membershipNumber }}</div>
              }
            </td>
            <td>{{ p.playerProfile ? t('levels.' + p.playerProfile.level) : '—' }}</td>
            <td class="mono">{{ p.playerProfile?.ntrpRating ?? '—' }}</td>
            <td class="mono tb-muted">
              @for (m of p.clubMemberships; track m.club.id) {
                <div>{{ m.currentMembership?.expiresAt | tbDate: 'date' }}</div>
              }
            </td>
            <td><tb-status-badge kind="user" [value]="p.status" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7"><tb-empty-state [message]="list.hasFilters() ? t('list.emptyFiltered') : t('list.empty')" icon="pi pi-users" /></td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `.hint { display: flex; gap: var(--tb-space-2); align-items: center; margin: calc(-1 * var(--tb-space-4)) 0 var(--tb-space-5); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationPlayersPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(ClubApi);

  readonly id = input.required<string>();
  protected readonly list = injectListQuery(['clubId']);
  protected readonly players = resource({
    params: () => ({ id: this.id(), query: this.list.query() }),
    loader: ({ params }) => this.api.federationPlayers(params.id, params.query),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.players.value>, ReturnType<typeof this.players.value>>({
    source: () => this.players.value(),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly clubOptions = computed(() => (this.page()?.clubs ?? []).map((c) => ({ label: c.name, value: c.id })));
}
