import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AuthzService } from '../../core/authz/authz.service';
import { WorkspaceStore } from '../../core/context/workspace.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { EmptyState } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { TournamentApi } from '../tournaments/tournament.api';
import type { ReportScope } from './insights.models';
import { ReportView } from './report-view';

interface Subject {
  scope: ReportScope;
  id: string;
  /** Scope for permission checks. */
  organizationId?: string;
  competitionId?: string;
}

/**
 * /reports — follows the workspace: a club's or a federation's reports, a
 * tournament's in a tournament workspace; on the platform, pick what to
 * report on.
 */
@Component({
  selector: 'tb-reports-page',
  imports: [FormsModule, SelectModule, EmptyState, PageHeader, ReportView],
  template: `
    <tb-page-header [title]="t('reportsPage.title')" [subtitle]="subtitle()">
      @if (!fromWorkspace()) {
        <p-select [options]="choices()" [ngModel]="picked()" (ngModelChange)="picked.set($event)" [group]="true" optionGroupLabel="label" optionGroupChildren="items" [filter]="true" [placeholder]="t('reportsPage.scope')" [attr.aria-label]="t('reportsPage.scope')" styleClass="scope-select" appendTo="body" />
      }
    </tb-page-header>
    @if (subject(); as s) {
      <tb-report-view [scope]="s.scope" [subjectId]="s.id" [canExport]="canExport()" />
    } @else {
      <div class="tb-card"><tb-empty-state [message]="t('reportsPage.pickScope')" icon="pi pi-chart-bar" /></div>
    }
  `,
  styles: `:host ::ng-deep .scope-select { min-width: 300px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  protected readonly t = inject(I18nService).t;
  private readonly workspaces = inject(WorkspaceStore);
  private readonly authz = inject(AuthzService);
  private readonly tournaments = inject(TournamentApi);

  /** The workspace decides, except on the platform. */
  protected readonly fromWorkspace = computed<Subject | null>(() => {
    const w = this.workspaces.current();
    if (w?.kind === 'competition') return { scope: 'tournament', id: w.competition.id, competitionId: w.competition.id };
    if (w?.kind === 'organization') {
      const org = w.organization;
      if (org.type === 'CLUB' && org.clubId) return { scope: 'club', id: org.clubId, organizationId: org.id };
      if (org.type === 'FEDERATION') return { scope: 'federation', id: org.id, organizationId: org.id };
    }
    return null;
  });

  private readonly options = resource({
    params: () => (this.fromWorkspace() ? undefined : true),
    loader: async () => {
      const [hosts, list] = await Promise.all([this.tournaments.hostOptions(), this.tournaments.list({ page: 1, pageSize: 100, sort: 'startDate:desc', filters: {} })]);
      return { hosts, list };
    },
  });
  protected readonly choices = computed(() => {
    const o = this.options.value();
    if (!o) return [];
    const orgs = o.hosts.organizations;
    return [
      { label: this.t('reportsPage.club'), items: orgs.filter((x) => x.type === 'CLUB' && x.clubId).map((x) => ({ label: x.name, value: `club:${x.clubId}:${x.id}` })) },
      { label: this.t('reportsPage.federation'), items: orgs.filter((x) => x.type === 'FEDERATION').map((x) => ({ label: x.name, value: `federation:${x.id}:${x.id}` })) },
      { label: this.t('reportsPage.tournament'), items: o.list.items.map((x) => ({ label: x.name, value: `tournament:${x.id}:` })) },
    ].filter((g) => g.items.length);
  });
  protected readonly picked = signal<string | null>(null);

  protected readonly subject = computed<Subject | null>(() => {
    const fixed = this.fromWorkspace();
    if (fixed) return fixed;
    const picked = this.picked();
    if (!picked) return null;
    const [scope, id, organizationId] = picked.split(':') as [ReportScope, string, string];
    return scope === 'tournament' ? { scope, id, competitionId: id } : { scope, id, organizationId };
  });
  protected readonly subtitle = computed(() => {
    const w = this.workspaces.current();
    return w?.kind === 'organization' ? w.organization.name : w?.kind === 'competition' ? w.competition.name : this.t('reportsPage.subtitle');
  });
  protected readonly canExport = computed(() => {
    const s = this.subject();
    return !!s && this.authz.hasPermission('report.export', { organizationId: s.organizationId, competitionId: s.competitionId });
  });
}
