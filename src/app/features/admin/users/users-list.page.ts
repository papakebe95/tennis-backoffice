import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { I18nService } from '../../../core/i18n/i18n.service';
import { injectListQuery } from '../../../shared/data/list-query';
import { TbAgoPipe, TbDatePipe } from '../../../shared/format';
import { EmptyState, UserCell } from '../../../shared/ui/bits';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchInput } from '../../../shared/ui/search-input';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { AdminApi } from '../admin.api';
import type { UserGrant } from '../admin.models';

const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'DISABLED', 'REJECTED'] as const;

@Component({
  selector: 'tb-users-list-page',
  imports: [FormsModule, TableModule, SelectModule, ButtonModule, TagModule, PageHeader, SearchInput, StatusBadge, UserCell, EmptyState, TbDatePipe, TbAgoPipe],
  templateUrl: './users-list.page.html',
  styleUrl: '../admin-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);

  protected readonly list = injectListQuery(['status', 'roleKey'], { sort: 'createdAt:desc' });
  protected readonly users = resource({ params: () => this.list.query(), loader: ({ params }) => this.api.users(params) });
  /** Keeps the previous page on screen while the next one loads. */
  protected readonly page = linkedSignal<ReturnType<typeof this.users.value>, ReturnType<typeof this.users.value>>({
    source: () => this.users.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly roles = resource({ loader: () => this.api.roles() });
  protected readonly roleOptions = computed(() => (this.roles.value() ?? []).map((r) => ({ label: r.name, value: r.key })));
  protected readonly statusOptions = computed(() =>
    STATUSES.map((status) => ({ label: this.t(`status.user.${status}`), value: status })),
  );

  protected open(id: string) {
    void this.router.navigate(['/users', id]);
  }

  protected grantLabel(grant: UserGrant): string {
    const where = grant.organization?.name ?? grant.competition?.name;
    return where ? `${grant.role.name} · ${where}` : grant.role.name;
  }
}
