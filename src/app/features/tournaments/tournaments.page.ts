import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { AuthzService } from '../../core/authz/authz.service';
import { WorkspaceStore } from '../../core/context/workspace.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { TournamentApi } from './tournament.api';
import { TOURNAMENT_STATUSES } from './tournament.models';

/**
 * /tournaments — in an organization workspace, the tournaments it hosts; on
 * the platform, every tournament the user may see.
 */
@Component({
  selector: 'tb-tournaments-page',
  imports: [FormsModule, RouterLink, ButtonModule, SelectModule, TableModule, PageHeader, SearchInput, StatusBadge, EmptyState, TbDatePipe],
  template: `
    <tb-page-header [title]="t('tournaments.title')" [subtitle]="workspaces.organization()?.name ?? t('tournaments.subtitle')">
      @if (canCreate()) {
        <a routerLink="/tournaments/new"><p-button [label]="t('tournaments.new')" icon="pi pi-plus" /></a>
      }
    </tb-page-header>

    <div class="tb-card list-card">
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('tournaments.searchPlaceholder')" (search)="list.update({ q: $event })" />
        <p-select
          [options]="statusOptions()"
          [ngModel]="list.query().filters['status'] ?? null"
          (ngModelChange)="list.update({ status: $event })"
          [placeholder]="t('tournaments.status')"
          [showClear]="true"
          [attr.aria-label]="t('tournaments.status')"
        />
        @if (list.hasFilters()) {
          <p-button [label]="t('list.clearFilters')" [text]="true" severity="secondary" icon="pi pi-filter-slash" (onClick)="list.clearFilters()" />
        }
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table
        [value]="page()?.items ?? []"
        [lazy]="true"
        [loading]="tournaments.isLoading()"
        [paginator]="true"
        [rows]="list.query().pageSize"
        [first]="list.first()"
        [totalRecords]="page()?.total ?? 0"
        [rowsPerPageOptions]="[20, 50, 100]"
        sortMode="multiple"
        [multiSortMeta]="list.sortMeta()"
        (onLazyLoad)="list.onLazyLoad($event)"
        (onSort)="list.onSort($event)"
        dataKey="id"
        [rowHover]="true"
        styleClass="tb-table"
      >
        <ng-template #header>
          <tr>
            <th pSortableColumn="name">{{ t('tournaments.columns.tournament') }} <p-sorticon field="name" /></th>
            <th pSortableColumn="startDate">{{ t('tournaments.columns.dates') }} <p-sorticon field="startDate" /></th>
            <th>{{ t('tournaments.columns.host') }}</th>
            <th>{{ t('tournaments.columns.tables') }}</th>
            <th>{{ t('tournaments.columns.entries') }}</th>
            <th pSortableColumn="status">{{ t('tournaments.columns.status') }} <p-sorticon field="status" /></th>
          </tr>
        </ng-template>
        <ng-template #body let-row>
          <tr class="clickable" (click)="open(row.id)" (keydown.enter)="open(row.id)" tabindex="0">
            <td>
              <div class="name">
                <span class="thumb" aria-hidden="true">
                  @if (row.bannerUrl) {
                    <img [src]="row.bannerUrl" alt="" loading="lazy" />
                  } @else {
                    <i class="pi pi-trophy"></i>
                  }
                </span>
                <span>
                  <strong>{{ row.name }}</strong>
                  <small class="tb-muted">{{ row.location ?? row.club?.name ?? '' }}</small>
                </span>
              </div>
            </td>
            <td class="mono">{{ row.startDate | tbDate: 'date' }} → {{ row.endDate | tbDate: 'date' }}</td>
            <td class="tb-muted">{{ row.hostOrganization?.name ?? t('tournaments.independent') }}</td>
            <td class="mono">{{ row.eventCount }}</td>
            <td class="tb-muted">{{ t('tournaments.entriesSummary', { approved: row.entries.approved, pending: row.entries.pending }) }}</td>
            <td><tb-status-badge kind="tournament" [value]="row.status" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="6"><tb-empty-state [message]="list.hasFilters() ? t('list.emptyFiltered') : t('list.empty')" icon="pi pi-trophy" /></td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    .name { display: flex; align-items: center; gap: var(--tb-space-3); min-width: 240px; }
    .name > span:last-child { display: grid; }
    .thumb {
      width: 44px; height: 44px; flex: none; border-radius: var(--tb-radius-md); overflow: hidden;
      display: grid; place-items: center; background: var(--tb-primary-50); color: var(--tb-primary-700);
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentsPage {
  protected readonly t = inject(I18nService).t;
  protected readonly workspaces = inject(WorkspaceStore);
  private readonly api = inject(TournamentApi);
  private readonly authz = inject(AuthzService);
  private readonly router = inject(Router);

  protected readonly list = injectListQuery(['status'], { sort: 'startDate:desc' });
  /** In an organization workspace, only what that organization hosts. */
  private readonly apiQuery = computed(() => {
    const q = this.list.query();
    return { ...q, filters: { status: q.filters['status'], hostOrganizationId: this.workspaces.organization()?.id } };
  });
  protected readonly tournaments = resource({ params: () => this.apiQuery(), loader: ({ params }) => this.api.list(params) });
  protected readonly page = linkedSignal<ReturnType<typeof this.tournaments.value>, ReturnType<typeof this.tournaments.value>>({
    source: () => this.tournaments.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly canCreate = computed(() => this.authz.hasPermission('tournament.create'));
  protected readonly statusOptions = computed(() =>
    TOURNAMENT_STATUSES.map((s) => ({ label: this.t(`status.tournament.${s}`), value: s })),
  );

  protected open(id: string) {
    void this.router.navigate(['/tournaments', id]);
  }
}
