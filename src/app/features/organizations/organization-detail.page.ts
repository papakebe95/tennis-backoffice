import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiError } from '../../core/api/api';
import { AuthzService } from '../../core/authz/authz.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbDatePipe } from '../../shared/format';
import { EmptyState, KpiCard } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { StatusBadge } from '../../shared/ui/status-badge';
import { OrgApi } from './org.api';
import type { OrganizationStatus } from './org.models';

@Component({
  selector: 'tb-organization-detail-page',
  imports: [RouterLink, ButtonModule, SkeletonModule, StatusBadge, EmptyState, KpiCard, TbDatePipe],
  template: `
    <a class="back" routerLink="/organizations"><i class="pi pi-arrow-left" aria-hidden="true"></i> {{ t('orgs.detail.back') }}</a>

    @if (org.error()) {
      <div class="tb-card"><tb-empty-state [message]="t('list.loadError')" icon="pi pi-exclamation-triangle" /></div>
    } @else if (org.value(); as o) {
      <header class="tb-card head">
        <div class="logo" aria-hidden="true">
          @if (o.logoUrl) {
            <img [src]="o.logoUrl" alt="" />
          } @else {
            <i [class]="o.type === 'FEDERATION' ? 'pi pi-flag' : o.type === 'CLUB' ? 'pi pi-building' : 'pi pi-users'"></i>
          }
        </div>
        <div class="title">
          <h1>{{ o.name }}</h1>
          <span class="tb-muted">{{ t('organizationType.' + o.type) }}{{ o.club ? ' · ' + o.club.city.name : '' }}</span>
        </div>
        <tb-status-badge kind="organization" [value]="o.status" />
        <div class="actions">
          @if (o.club) {
            <a [routerLink]="['/clubs', o.club.id]"><p-button [label]="t('orgs.detail.openClub')" icon="pi pi-external-link" [outlined]="true" /></a>
          }
          @if (o.type === 'FEDERATION') {
            <a [routerLink]="['/federations', o.id]"><p-button [label]="t('orgs.detail.openFederation')" icon="pi pi-external-link" [outlined]="true" /></a>
          }
          @if (canManage) {
            @for (status of nextStatuses(); track status) {
              <p-button
                [label]="t('orgs.detail.actions.' + status)"
                [severity]="status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warn' : 'secondary'"
                [text]="status === 'ARCHIVED'"
                (onClick)="setStatus(status)"
              />
            }
          }
        </div>
      </header>

      @if (o.club) {
        <section class="kpis">
          <tb-kpi-card [label]="t('orgs.detail.courts')" [value]="o.club.courts" icon="pi pi-th-large" />
          <tb-kpi-card [label]="t('orgs.detail.bookings')" [value]="o.club.bookings" icon="pi pi-calendar" />
          <tb-kpi-card [label]="t('orgs.detail.administrators')" [value]="o.administrators.length" icon="pi pi-users" />
        </section>
      } @else if (o.type === 'FEDERATION') {
        <section class="kpis">
          <tb-kpi-card [label]="t('orgs.detail.affiliatedClubs')" [value]="o.affiliatedClubs" icon="pi pi-building" />
          <tb-kpi-card [label]="t('orgs.detail.administrators')" [value]="o.administrators.length" icon="pi pi-users" />
        </section>
      }

      <div class="grid">
        <section class="tb-card">
          <h2 class="tb-card-title">{{ t('orgs.detail.contact') }}</h2>
          <dl>
            <dt>{{ t('profile2.email') }}</dt><dd>{{ o.email || '—' }}</dd>
            <dt>{{ t('profile2.phone') }}</dt><dd>{{ o.phone || '—' }}</dd>
            <dt>{{ t('profile2.website') }}</dt><dd>@if (o.website) { <a [href]="o.website" target="_blank" rel="noopener">{{ o.website }}</a> } @else { — }</dd>
            <dt>{{ t('profile2.address') }}</dt><dd>{{ o.address || '—' }}</dd>
          </dl>
          @if (o.description) {
            <p class="description">{{ o.description }}</p>
          }
        </section>

        <section class="tb-card">
          <h2 class="tb-card-title">{{ t('orgs.detail.administrators') }}</h2>
          @for (a of o.administrators; track a.id) {
            <a class="admin" [routerLink]="['/users', a.user.id]">
              <strong>{{ a.user.firstname }} {{ a.user.lastname }}</strong>
              <span class="tb-muted">{{ a.role.name }} · {{ a.user.msisdn }}</span>
            </a>
          } @empty {
            <p class="tb-muted">{{ t('orgs.detail.noAdministrators') }}</p>
          }
        </section>

        @if (o.type === 'CLUB') {
          <section class="tb-card">
            <h2 class="tb-card-title">{{ t('orgs.detail.affiliations') }}</h2>
            @for (m of o.memberships; track m.id) {
              <div class="affiliation">
                <span>{{ m.parent.name }}</span>
                <tb-status-badge kind="affiliation" [value]="m.status" />
                <small class="tb-muted">{{ (m.validatedAt ?? m.requestedAt) | tbDate: 'date' }}</small>
              </div>
            } @empty {
              <p class="tb-muted">{{ t('orgs.detail.noAffiliations') }}</p>
            }
          </section>
        }
      </div>
    } @else {
      <p-skeleton height="140px" borderRadius="14px" />
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-6); }
    .back { display: inline-flex; align-items: center; gap: var(--tb-space-2); color: var(--tb-text-muted); text-decoration: none; font-weight: var(--tb-weight-medium); margin-bottom: calc(-1 * var(--tb-space-2)); }
    .head { display: grid; grid-template-columns: auto 1fr auto; gap: var(--tb-space-4); align-items: center; }
    .logo { width: 64px; height: 64px; border-radius: var(--tb-radius-lg); display: grid; place-items: center; background: var(--tb-primary-50); color: var(--tb-primary-700); font-size: 1.5rem; overflow: hidden; }
    .logo img { width: 100%; height: 100%; object-fit: cover; }
    .title h1 { font-size: var(--tb-text-2xl); }
    .actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--tb-space-2); }
    .kpis { display: grid; gap: var(--tb-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); }
    .grid { display: grid; gap: var(--tb-space-6); grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); align-items: start; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--tb-space-2) var(--tb-space-5); margin: 0; }
    dt { color: var(--tb-text-muted); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .description { margin: var(--tb-space-4) 0 0; color: var(--tb-text-muted); white-space: pre-line; }
    .admin { display: flex; flex-direction: column; padding: var(--tb-space-3) 0; border-top: 1px solid var(--tb-border); text-decoration: none; color: var(--tb-text); }
    .admin:first-of-type { border-top: 0; padding-top: 0; }
    .affiliation { display: flex; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-2) 0; }
    .affiliation small { margin-left: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetailPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(OrgApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);
  protected readonly canManage = inject(AuthzService).hasGlobalPermission('organization.manage');

  readonly id = input.required<string>();
  protected readonly org = resource({ params: () => this.id(), loader: ({ params }) => this.api.organization(params) });

  protected readonly nextStatuses = computed<OrganizationStatus[]>(() => {
    switch (this.org.value()?.status) {
      case 'ACTIVE':
        return ['SUSPENDED', 'ARCHIVED'];
      case 'SUSPENDED':
        return ['ACTIVE', 'ARCHIVED'];
      case 'PENDING':
        return ['ACTIVE', 'ARCHIVED'];
      case 'ARCHIVED':
        return ['ACTIVE'];
      default:
        return [];
    }
  });

  protected async setStatus(status: OrganizationStatus) {
    const result = await this.confirm.ask({
      title: this.t(`orgs.detail.confirm.${status}.title`),
      message: this.t(`orgs.detail.confirm.${status}.body`),
      confirmLabel: this.t(`orgs.detail.actions.${status}`),
      severity: status === 'ACTIVE' ? 'primary' : 'danger',
      reason: status === 'ACTIVE' ? 'optional' : 'required',
    });
    if (!result) return;
    try {
      await this.api.setOrganizationStatus(this.id(), status, result.reason);
      this.toasts.add({ severity: 'success', summary: this.t('orgs.detail.statusChanged') });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    this.org.reload();
  }
}
