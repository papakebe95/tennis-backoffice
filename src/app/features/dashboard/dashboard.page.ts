import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SessionStore } from '../../core/auth/session.store';
import { AuthzService } from '../../core/authz/authz.service';
import type { AccessGrant } from '../../core/auth/auth.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageHeader } from '../../shared/ui/page-header';
import { GlobalDashboard } from '../admin/global-dashboard';
import { ClubDashboard } from '../club/club-dashboard';
import { WorkspaceStore } from '../../core/context/workspace.store';

/**
 * Landing page. Platform administrators see the global dashboard; everyone
 * else sees their access (straight from /auth/me) until their module's own
 * dashboard (club, federation, tournament) is built.
 */
@Component({
  selector: 'tb-dashboard-page',
  imports: [PageHeader, GlobalDashboard, ClubDashboard, RouterLink, ButtonModule],
  template: `
    @if (clubId(); as club) {
      <tb-club-dashboard [clubId]="club" />
    } @else if (showGlobal()) {
      <tb-global-dashboard />
    } @else {
    <tb-page-header [title]="t('dashboard.greeting', { name: session.user()?.firstname })" [subtitle]="t('dashboard.subtitle')" />

    <section class="tb-card">
      <h2 class="tb-card-title">{{ t('dashboard.access') }}</h2>
      @if (grants().length === 0) {
        <p class="tb-muted">{{ t('dashboard.noAccess') }}</p>
        <a routerLink="/access"><p-button [label]="t('register.createAccount')" icon="pi pi-send" /></a>
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
    }
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
  private readonly authz = inject(AuthzService);
  protected readonly grants = this.authz.grants;
  private readonly workspaces = inject(WorkspaceStore);
  /** In a club workspace, that club's dashboard (when allowed). */
  protected readonly clubId = computed(() => {
    const org = this.workspaces.organization();
    return org?.clubId && this.authz.hasPermission('club.dashboard.view', { organizationId: org.id }) ? org.clubId : null;
  });
  /** Platform administrators get the global dashboard. */
  protected readonly showGlobal = computed(() => this.authz.grants() && this.authz.hasGlobalPermission('dashboard.global.view'));

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
