import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SessionStore } from '../../core/auth/session.store';
import { AuthzService } from '../../core/authz/authz.service';
import type { AccessGrant } from '../../core/auth/auth.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { PageHeader } from '../../shared/ui/page-header';

/**
 * Phase 1 dashboard: who you are and what you can do, straight from
 * /auth/me. KPI and pending-action widgets arrive with their modules, each
 * backed by its own API — nothing here is placeholder data.
 */
@Component({
  selector: 'tb-dashboard-page',
  imports: [PageHeader],
  template: `
    <tb-page-header [title]="t('dashboard.greeting', { name: session.user()?.firstname })" [subtitle]="t('dashboard.subtitle')" />

    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('dashboard.access') }}</h2>
      @if (grants().length === 0) {
        <p class="tb-muted">{{ t('dashboard.noAccess') }}</p>
      } @else {
        <div class="grants">
          @for (grant of grants(); track grant.id) {
            <article class="grant">
              <div class="icon" [attr.data-scope]="grant.scope"><i [class]="iconFor(grant)" aria-hidden="true"></i></div>
              <div>
                <strong>{{ grant.roleName }}</strong>
                <div class="where">{{ scopeLabel(grant) }}</div>
                <div class="count">{{ t('dashboard.permissionsCount', { count: grant.permissions.length }) }}</div>
              </div>
            </article>
          }
        </div>
      }
    </section>

    <section class="tb-card upcoming">
      <h2 class="tb-card-title">{{ t('dashboard.upcoming') }}</h2>
      <p class="tb-muted">{{ t('dashboard.upcomingBody') }}</p>
    </section>
  `,
  styles: `
    .grants { display: grid; gap: var(--tb-space-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
    .grant { display: flex; gap: var(--tb-space-3); padding: var(--tb-space-4); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); }
    .icon { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--tb-radius-md); }
    .icon[data-scope='GLOBAL'] { background: var(--tb-tone-accent-bg); color: var(--tb-tone-accent-fg); }
    .icon[data-scope='ORGANIZATION'] { background: var(--tb-tone-success-bg); color: var(--tb-tone-success-fg); }
    .icon[data-scope='COMPETITION'] { background: var(--tb-tone-info-bg); color: var(--tb-tone-info-fg); }
    .where { color: var(--tb-text-muted); margin-top: 2px; }
    .count { color: var(--tb-text-subtle); font-size: var(--tb-text-xs); margin-top: var(--tb-space-1); }
    .upcoming { margin-top: var(--tb-space-6); }
    .upcoming p { margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly session = inject(SessionStore);
  protected readonly t = inject(I18nService).t;
  protected readonly grants = inject(AuthzService).grants;

  protected readonly iconFor = (grant: AccessGrant) =>
    grant.scope === 'GLOBAL' ? 'pi pi-globe' : grant.scope === 'COMPETITION' ? 'pi pi-trophy' : 'pi pi-building';

  protected scopeLabel(grant: AccessGrant): string {
    if (grant.organization) {
      return `${this.t(`organizationType.${grant.organization.type}`)} · ${grant.organization.name}`;
    }
    if (grant.competition) return `${this.t('roleScope.COMPETITION')} · ${grant.competition.name}`;
    return this.t('roleScope.GLOBAL');
  }
}
