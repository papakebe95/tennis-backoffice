import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiError } from '../../core/api/api';
import type { OrganizationType } from '../../core/auth/auth.models';
import { AuthzService } from '../../core/authz/authz.service';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { EmptyState } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AccessApi } from '../access/access.api';
import { OrgApi } from './org.api';

const TYPES: OrganizationType[] = ['FEDERATION', 'CLUB', 'COMMUNITY'];
const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'ARCHIVED'];

@Component({
  selector: 'tb-organizations-page',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, SelectModule, TableModule, PageHeader, SearchInput, StatusBadge, EmptyState],
  templateUrl: './organizations.page.html',
  styleUrls: ['../admin/admin-list.scss', './organizations.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(OrgApi);
  private readonly accessApi = inject(AccessApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(MessageService);
  protected readonly canCreate = inject(AuthzService).hasGlobalPermission('organization.create');

  protected readonly list = injectListQuery(['type', 'status'], { sort: 'name:asc' });
  protected readonly orgs = resource({ params: () => this.list.query(), loader: ({ params }) => this.api.organizations(params) });
  protected readonly page = linkedSignal<ReturnType<typeof this.orgs.value>, ReturnType<typeof this.orgs.value>>({
    source: () => this.orgs.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly typeOptions = computed(() => TYPES.map((type) => ({ label: this.t(`organizationType.${type}`), value: type })));
  protected readonly statusOptions = computed(() => STATUSES.map((s) => ({ label: this.t(`status.organization.${s}`), value: s })));

  // Create dialog
  protected readonly creating = signal(false);
  protected readonly draft = signal({ type: 'CLUB' as OrganizationType, name: '', cityId: null as string | null, email: '', phone: '' });
  protected readonly createError = signal<string | null>(null);
  protected readonly saving = signal(false);
  private readonly options = resource({ params: () => (this.creating() ? true : undefined), loader: () => this.accessApi.options() });
  protected readonly cities = computed(() => (this.options.value()?.countries ?? []).flatMap((c) => c.cities));

  protected open(id: string) {
    void this.router.navigate(['/organizations', id]);
  }

  protected patch(changes: Partial<ReturnType<typeof this.draft>>) {
    this.draft.set({ ...this.draft(), ...changes });
  }

  protected canSubmit() {
    const d = this.draft();
    return d.name.trim().length >= 2 && (d.type !== 'CLUB' || !!d.cityId) && !this.saving();
  }

  protected async create() {
    const d = this.draft();
    this.saving.set(true);
    this.createError.set(null);
    try {
      const org = await this.api.createOrganization({
        type: d.type,
        name: d.name.trim(),
        cityId: d.type === 'CLUB' ? (d.cityId ?? undefined) : undefined,
        email: d.email.trim() || undefined,
        phone: d.phone.trim() || undefined,
      });
      this.creating.set(false);
      this.toasts.add({ severity: 'success', summary: this.t('orgs.create.created') });
      this.open(org.id);
    } catch (raw) {
      this.createError.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
