import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { AutoCompleteModule, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe } from '../../shared/format';
import { ImageUpload } from '../../shared/forms/image-upload';
import { SaveBar, SocialLinksFields } from '../../shared/forms/profile-bits';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { PageHeader } from '../../shared/ui/page-header';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminApi } from '../admin/admin.api';
import { OrgApi, type OrganizationProfileInput } from './org.api';
import type { AffiliatedClub, OrganizationDetail } from './org.models';

type ProfileDraft = Required<Omit<OrganizationProfileInput, 'socialLinks'>> & Pick<OrganizationProfileInput, 'socialLinks'>;

const toDraft = (o: OrganizationDetail): ProfileDraft => ({
  name: o.name,
  description: o.description ?? '',
  logoUrl: o.logoUrl,
  email: o.email ?? '',
  phone: o.phone ?? '',
  website: o.website ?? '',
  address: o.address ?? '',
  socialLinks: o.socialLinks ?? {},
});

/** /federations/:id — the federation's public profile, editable in place. */
@Component({
  selector: 'tb-federation-profile-page',
  imports: [FormsModule, ButtonModule, InputTextModule, MessageModule, SkeletonModule, TextareaModule, PageHeader, ImageUpload, SocialLinksFields, SaveBar, StatusBadge],
  template: `
    <tb-page-header [title]="t('federation.profileTitle')" [subtitle]="t('federation.profileSubtitle')">
      @if (federation.value(); as f) {
        <tb-status-badge kind="organization" [value]="f.status" />
      }
    </tb-page-header>
    @if (!canEdit()) {
      <p-message severity="info" class="msg">{{ t('profile2.readOnly') }}</p-message>
    }
    @if (error()) {
      <p-message severity="error" class="msg">{{ error() }}</p-message>
    }
    @if (draft(); as d) {
      <div class="grid">
        <section class="tb-card">
          <h2 class="tb-card-title">{{ t('profile2.identity') }}</h2>
          <div class="tb-field">
            <span class="label">{{ t('profile2.logo') }}</span>
            <tb-image-upload folder="organizations" shape="logo" [url]="d.logoUrl" (urlChange)="patch({ logoUrl: $event })" [disabled]="!canEdit()" />
          </div>
          <div class="tb-field">
            <label for="fed-name">{{ t('profile2.name') }}</label>
            <input pInputText id="fed-name" [ngModel]="d.name" (ngModelChange)="patch({ name: $event })" [disabled]="!canEdit()" maxlength="120" />
          </div>
          <div class="tb-field">
            <label for="fed-description">{{ t('profile2.description') }}</label>
            <textarea pTextarea id="fed-description" rows="4" [autoResize]="true" [ngModel]="d.description" (ngModelChange)="patch({ description: $event })" [disabled]="!canEdit()" maxlength="2000"></textarea>
          </div>
        </section>
        <section class="tb-card">
          <h2 class="tb-card-title">{{ t('profile2.contact') }}</h2>
          <div class="tb-field">
            <label for="fed-email">{{ t('profile2.email') }}</label>
            <input pInputText id="fed-email" type="email" [ngModel]="d.email" (ngModelChange)="patch({ email: $event })" [disabled]="!canEdit()" />
          </div>
          <div class="tb-field">
            <label for="fed-phone">{{ t('profile2.phone') }}</label>
            <input pInputText id="fed-phone" [ngModel]="d.phone" (ngModelChange)="patch({ phone: $event })" [disabled]="!canEdit()" inputmode="tel" />
          </div>
          <div class="tb-field">
            <label for="fed-website">{{ t('profile2.website') }}</label>
            <input pInputText id="fed-website" type="url" [ngModel]="d.website" (ngModelChange)="patch({ website: $event })" [disabled]="!canEdit()" placeholder="https://" />
          </div>
          <div class="tb-field">
            <label for="fed-address">{{ t('profile2.address') }}</label>
            <input pInputText id="fed-address" [ngModel]="d.address" (ngModelChange)="patch({ address: $event })" [disabled]="!canEdit()" />
          </div>
        </section>
        <section class="tb-card wide">
          <h2 class="tb-card-title">{{ t('profile2.social') }}</h2>
          <tb-social-links-fields [value]="d.socialLinks ?? null" (valueChange)="patch({ socialLinks: $event })" [disabled]="!canEdit()" />
        </section>
      </div>
      <tb-save-bar [dirty]="dirty()" [saving]="saving()" [invalid]="d.name.trim().length < 2" (save)="save()" (discard)="reset()" />
    } @else {
      <p-skeleton height="320px" borderRadius="14px" />
    }
  `,
  styles: `
    .grid { display: grid; gap: var(--tb-space-6); grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); align-items: start; }
    .wide { grid-column: 1 / -1; }
    .label { font-size: var(--tb-text-sm); font-weight: var(--tb-weight-medium); }
    textarea, input { width: 100%; }
    .msg { display: block; margin-bottom: var(--tb-space-4); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationProfilePage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(OrgApi);
  private readonly authz = inject(AuthzService);
  private readonly toasts = inject(MessageService);

  readonly id = input.required<string>();
  protected readonly federation = resource({ params: () => this.id(), loader: ({ params }) => this.api.federation(params) });
  protected readonly draft = signal<ProfileDraft | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canEdit = computed(() => this.authz.hasPermission('federation.update', { organizationId: this.id() }));
  protected readonly dirty = computed(() => {
    const f = this.federation.value();
    const d = this.draft();
    return !!f && !!d && JSON.stringify(toDraft(f)) !== JSON.stringify(d);
  });

  constructor() {
    effect(() => {
      const f = this.federation.value();
      if (f) this.draft.set(toDraft(f));
    });
  }

  protected patch(changes: Partial<ProfileDraft>) {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...changes });
  }

  protected reset() {
    const f = this.federation.value();
    if (f) this.draft.set(toDraft(f));
    this.error.set(null);
  }

  protected async save() {
    const d = this.draft();
    if (!d) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.updateFederation(this.id(), {
        ...d,
        name: d.name.trim(),
        description: d.description?.trim() || null,
        email: d.email?.trim() || null,
        phone: d.phone?.trim() || null,
        website: d.website?.trim() || null,
        address: d.address?.trim() || null,
      });
      this.toasts.add({ severity: 'success', summary: this.t('profile2.saved') });
      this.federation.reload();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}

const TABS = ['OPEN', 'PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED'] as const;
type Action = 'approve' | 'suspend' | 'end';

/** /federations/:id/clubs — affiliation requests and affiliated clubs. */
@Component({
  selector: 'tb-federation-clubs-page',
  imports: [FormsModule, AutoCompleteModule, ButtonModule, DialogModule, TableModule, PageHeader, SearchInput, StatusBadge, EmptyState, TbDatePipe],
  template: `
    <tb-page-header [title]="t('federation.clubsTitle')" [subtitle]="t('federation.clubsSubtitle')">
      @if (canValidate()) {
        <p-button [label]="t('federation.addClub')" icon="pi pi-plus" (onClick)="adding.set(true)" />
      }
    </tb-page-header>

    <div class="tb-card list-card">
      <div class="tabs" role="tablist">
        @for (tab of tabs; track tab) {
          <button type="button" role="tab" [class.active]="status() === tab" [attr.aria-selected]="status() === tab" (click)="list.update({ status: tab === 'OPEN' ? null : tab })">
            {{ t('federation.tabs.' + tab) }}
            @if (count(tab) !== null) {
              <span class="count">{{ count(tab) }}</span>
            }
          </button>
        }
      </div>
      <div class="filters">
        <tb-search-input [value]="list.query().q" [placeholder]="t('federation.searchClub')" (search)="list.update({ q: $event })" />
        <span class="total">{{ t('list.total', { count: page()?.total ?? 0 }) }}</span>
      </div>
      <p-table [value]="page()?.items ?? []" [lazy]="true" [loading]="clubs.isLoading()" [paginator]="(page()?.total ?? 0) > list.query().pageSize" [rows]="list.query().pageSize" [first]="list.first()" [totalRecords]="page()?.total ?? 0" (onLazyLoad)="list.onLazyLoad($event)" dataKey="id" styleClass="tb-table">
        <ng-template #header>
          <tr>
            <th>{{ t('federation.columns.club') }}</th>
            <th>{{ t('federation.columns.city') }}</th>
            <th>{{ t('federation.columns.courts') }}</th>
            <th>{{ t('federation.columns.since') }}</th>
            <th>{{ t('federation.columns.status') }}</th>
            <th><span class="tb-sr-only">{{ t('list.actions') }}</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-a>
          <tr>
            <td>
              <strong>{{ a.club.name }}</strong>
              @if (a.club.status !== 'ACTIVE') {
                <tb-status-badge kind="organization" [value]="a.club.status" />
              }
              <div class="tb-muted small">{{ a.club.email ?? a.club.phone ?? '' }}</div>
            </td>
            <td class="tb-muted">{{ a.club.city ?? '—' }}</td>
            <td class="tb-muted">{{ a.club.courts }}</td>
            <td class="tb-muted mono">{{ a.requestedAt | tbDate: 'date' }}</td>
            <td><tb-status-badge kind="affiliation" [value]="a.status" /></td>
            <td class="row-actions">
              @if (canValidate()) {
                @for (action of actionsFor(a); track action) {
                  <p-button
                    [label]="t('federation.actions.' + action)"
                    size="small"
                    [text]="action !== 'approve'"
                    [severity]="action === 'approve' ? 'success' : action === 'suspend' ? 'warn' : 'secondary'"
                    (onClick)="decide(a, action)"
                  />
                }
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="6"><tb-empty-state [message]="t('list.empty')" icon="pi pi-building" /></td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="adding" [modal]="true" [header]="t('federation.addClub')" [style]="{ width: 'min(460px, 94vw)' }" [draggable]="false">
      <div class="tb-field">
        <label for="add-club">{{ t('federation.columns.club') }}</label>
        <p-autocomplete inputId="add-club" [ngModel]="picked()" (ngModelChange)="picked.set($event)" [suggestions]="suggestions()" (completeMethod)="search($event)" optionLabel="name" [dropdown]="true" [forceSelection]="true" [placeholder]="t('federation.searchClub')" appendTo="body" [fluid]="true" />
      </div>
      <ng-template #footer>
        <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="adding.set(false)" />
        <p-button [label]="t('federation.addClub')" icon="pi pi-check" [disabled]="!pickedId()" (onClick)="add()" />
      </ng-template>
    </p-dialog>
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    .small { font-size: var(--tb-text-xs); }
    .row-actions { text-align: right; white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationClubsPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(OrgApi);
  private readonly adminApi = inject(AdminApi);
  private readonly authz = inject(AuthzService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly id = input.required<string>();
  protected readonly tabs = TABS;
  protected readonly list = injectListQuery(['status']);
  protected readonly status = computed(() => this.list.query().filters['status'] ?? 'OPEN');
  private readonly apiQuery = computed(() => {
    const q = this.list.query();
    return { ...q, filters: { status: q.filters['status'] } };
  });
  protected readonly clubs = resource({
    params: () => ({ id: this.id(), query: this.apiQuery() }),
    loader: ({ params }) => this.api.federationClubs(params.id, params.query),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.clubs.value>, ReturnType<typeof this.clubs.value>>({
    source: () => this.clubs.value(),
    computation: (value, previous) => value ?? previous?.value,
  });
  protected readonly canValidate = computed(() => this.authz.hasPermission('federation.clubs.validate', { organizationId: this.id() }));

  protected readonly adding = signal(false);
  protected readonly picked = signal<{ id: string; name: string } | string | null>(null);
  protected readonly pickedId = computed(() => {
    const p = this.picked();
    return p && typeof p === 'object' ? p.id : null;
  });
  protected readonly suggestions = signal<{ id: string; name: string }[]>([]);

  protected count(tab: (typeof TABS)[number]): number | null {
    const counts = this.page()?.counts;
    if (!counts) return null;
    if (tab === 'OPEN') return (counts.PENDING ?? 0) + (counts.ACTIVE ?? 0) + (counts.SUSPENDED ?? 0);
    return counts[tab] ?? 0;
  }

  protected actionsFor(a: AffiliatedClub): Action[] {
    switch (a.status) {
      case 'PENDING':
        return ['approve', 'end'];
      case 'ACTIVE':
        return ['suspend', 'end'];
      case 'SUSPENDED':
        return ['approve', 'end'];
      default:
        return [];
    }
  }

  protected async decide(a: AffiliatedClub, action: Action) {
    const result = await this.confirm.ask({
      title: this.t(`federation.confirm.${action}.title`),
      message: this.t(`federation.confirm.${action}.body`, { club: a.club.name }),
      confirmLabel: this.t(`federation.actions.${action}`),
      severity: action === 'approve' ? 'primary' : 'danger',
      reason: action === 'approve' ? 'optional' : 'required',
    });
    if (!result) return;
    try {
      await this.api.decideAffiliation(this.id(), a.id, action, result.reason);
      this.toasts.add({ severity: 'success', summary: this.t('federation.updated') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.clubs.reload();
  }

  protected async search(event: AutoCompleteCompleteEvent) {
    const rows = await this.adminApi.lookupOrganizations(event.query, 'CLUB');
    this.suggestions.set(rows);
  }

  protected async add() {
    const id = this.pickedId();
    if (!id) return;
    try {
      await this.api.addClub(this.id(), id);
      this.adding.set(false);
      this.picked.set(null);
      this.toasts.add({ severity: 'success', summary: this.t('federation.added') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.clubs.reload();
  }
}
