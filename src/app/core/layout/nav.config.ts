import type { ScopeRef } from '../authz/authz.service';
import type { PermissionRule } from '../authz/permissions';
import type { Workspace } from '../context/workspace.store';
import type { I18nKey } from '../i18n/i18n.service';

/** Which workspaces an entry belongs to. */
export type WorkspaceKind = 'platform' | 'FEDERATION' | 'CLUB' | 'COMMUNITY' | 'competition';

export interface NavItem {
  id: string;
  label: I18nKey;
  icon: string;
  /** Shown only when the rule holds in the current workspace's scope. */
  requires?: PermissionRule;
  /** Highlight only on this exact page (links that prefix others). */
  exact?: boolean;
  /** Router link; absent while the module is not built yet ("Soon"). */
  link?: (workspace: Workspace | null) => unknown[];
}

export interface NavSection {
  id: string;
  label: I18nKey;
  /** Workspaces where the section shows; absent = all. */
  workspaces?: readonly WorkspaceKind[];
  items: NavItem[];
}

const orgId = (w: Workspace | null) => (w?.kind === 'organization' ? w.organization.id : '');
const competitionId = (w: Workspace | null) => (w?.kind === 'competition' ? w.competition.id : '');
const clubId = (w: Workspace | null) => (w?.kind === 'organization' ? (w.organization.clubId ?? '') : '');

// The whole menu, declared once. Nothing else decides what is visible: the
// shell renders visibleNav(NAV, workspace, can).
export const NAV: readonly NavSection[] = [
  {
    id: 'overview',
    label: 'nav.sections.overview',
    items: [{ id: 'dashboard', label: 'nav.dashboard', icon: 'pi pi-home', link: () => ['/dashboard'] }],
  },
  {
    id: 'platform',
    label: 'nav.sections.platform',
    workspaces: ['platform'],
    items: [
      { id: 'access-requests', label: 'nav.accessRequests', icon: 'pi pi-inbox', requires: { any: ['access_request.review'] }, link: () => ['/access-requests'] },
      { id: 'users', label: 'nav.users', icon: 'pi pi-users', requires: { any: ['user.view'] }, link: () => ['/users'] },
      { id: 'roles', label: 'nav.roles', icon: 'pi pi-shield', requires: { any: ['role.view'] }, link: () => ['/roles'] },
      { id: 'organizations', label: 'nav.organizations', icon: 'pi pi-building', requires: { any: ['organization.view'] }, link: () => ['/organizations'] },
      { id: 'tournaments', label: 'nav.tournaments', icon: 'pi pi-trophy', requires: { any: ['tournament.view'] }, link: () => ['/tournaments'] },
      { id: 'matches', label: 'nav.matches', icon: 'pi pi-stopwatch', requires: { any: ['match.view'] }, link: () => ['/matches'] },
      { id: 'payments', label: 'nav.payments', icon: 'pi pi-wallet', requires: { any: ['payment.view'] }, link: () => ['/payments'] },
      { id: 'audit', label: 'nav.auditLogs', icon: 'pi pi-history', requires: { any: ['audit.view'] }, link: () => ['/audit-logs'] },
      { id: 'reports', label: 'nav.reports', icon: 'pi pi-chart-bar', requires: { any: ['report.view'] } },
    ],
  },
  {
    id: 'federation',
    label: 'nav.sections.federation',
    workspaces: ['FEDERATION'],
    items: [
      { id: 'federation-profile', label: 'nav.federationProfile', icon: 'pi pi-flag', requires: { any: ['federation.view'] }, exact: true, link: (w) => ['/federations', orgId(w)] },
      { id: 'federation-clubs', label: 'nav.federationClubs', icon: 'pi pi-building', requires: { any: ['federation.clubs.view'] }, link: (w) => ['/federations', orgId(w), 'clubs'] },
      { id: 'federation-players', label: 'nav.federationPlayers', icon: 'pi pi-users', requires: { any: ['federation.players.view'] }, link: (w) => ['/federations', orgId(w), 'players'] },
      { id: 'federation-rankings', label: 'nav.federationRankings', icon: 'pi pi-sort-amount-down', requires: { any: ['federation.rankings.view'] } },
      { id: 'federation-tournaments', label: 'nav.tournaments', icon: 'pi pi-trophy', requires: { any: ['tournament.view'] }, link: () => ['/tournaments'] },
      { id: 'federation-reports', label: 'nav.reports', icon: 'pi pi-chart-bar', requires: { any: ['report.view'] } },
    ],
  },
  {
    id: 'club',
    label: 'nav.sections.club',
    workspaces: ['CLUB'],
    items: [
      { id: 'club-profile', label: 'nav.clubProfile', icon: 'pi pi-id-card', requires: { any: ['club.view'] }, exact: true, link: (w) => ['/clubs', clubId(w)] },
      { id: 'members', label: 'nav.members', icon: 'pi pi-users', requires: { any: ['member.view'] }, link: (w) => ['/clubs', clubId(w), 'members'] },
      { id: 'courts', label: 'nav.courts', icon: 'pi pi-th-large', requires: { any: ['court.view'] }, link: (w) => ['/clubs', clubId(w), 'courts'] },
      { id: 'bookings', label: 'nav.bookings', icon: 'pi pi-calendar', requires: { any: ['booking.view'] }, link: (w) => ['/clubs', clubId(w), 'bookings'] },
      { id: 'club-tournaments', label: 'nav.tournaments', icon: 'pi pi-trophy', requires: { any: ['tournament.view'] }, link: () => ['/tournaments'] },
      { id: 'club-matches', label: 'nav.matches', icon: 'pi pi-stopwatch', requires: { any: ['match.view'] }, link: () => ['/matches'] },
      { id: 'club-payments', label: 'nav.payments', icon: 'pi pi-wallet', requires: { any: ['payment.view'] }, link: (w) => ['/clubs', clubId(w), 'payments'] },
      { id: 'club-reports', label: 'nav.reports', icon: 'pi pi-chart-bar', requires: { any: ['report.view'] } },
    ],
  },
  {
    id: 'community',
    label: 'nav.sections.tournaments',
    workspaces: ['COMMUNITY'],
    items: [{ id: 'community-tournaments', label: 'nav.tournaments', icon: 'pi pi-trophy', requires: { any: ['tournament.view'] }, link: () => ['/tournaments'] }],
  },
  {
    id: 'competition',
    label: 'nav.sections.tournaments',
    workspaces: ['competition'],
    items: [
      { id: 'competition-overview', label: 'nav.tournamentOverview', icon: 'pi pi-trophy', requires: { any: ['tournament.view'] }, exact: true, link: (w) => ['/tournaments', competitionId(w)] },
      { id: 'competition-registrations', label: 'nav.registrations', icon: 'pi pi-list-check', requires: { any: ['registration.view'] }, link: (w) => ['/tournaments', competitionId(w), 'registrations'] },
      { id: 'competition-draw', label: 'nav.draw', icon: 'pi pi-sitemap', requires: { any: ['draw.view'] }, link: (w) => ['/tournaments', competitionId(w), 'draw'] },
      { id: 'competition-team', label: 'nav.team', icon: 'pi pi-id-card', requires: { any: ['tournament.view'] }, link: (w) => ['/tournaments', competitionId(w), 'team'] },
      { id: 'competition-matches', label: 'nav.matches', icon: 'pi pi-stopwatch', requires: { any: ['match.view'] }, link: (w) => ['/tournaments', competitionId(w), 'matches'] },
      { id: 'competition-schedule', label: 'nav.schedule', icon: 'pi pi-calendar-clock', requires: { any: ['match.schedule'] }, link: (w) => ['/tournaments', competitionId(w), 'schedule'] },
    ],
  },
  {
    id: 'account',
    label: 'nav.sections.account',
    items: [
      { id: 'access', label: 'nav.access', icon: 'pi pi-send', link: () => ['/access'] },
      { id: 'notifications', label: 'nav.notifications', icon: 'pi pi-bell' },
      { id: 'profile', label: 'nav.profile', icon: 'pi pi-user', link: () => ['/profile'] },
    ],
  },
];

export const workspaceKind = (workspace: Workspace | null): WorkspaceKind | null =>
  !workspace
    ? null
    : workspace.kind === 'organization'
      ? workspace.organization.type
      : workspace.kind;

/** The scope permission checks run against in a workspace. */
export const workspaceScope = (workspace: Workspace | null): ScopeRef | 'global' | null => {
  if (!workspace) return null;
  if (workspace.kind === 'platform') return 'global';
  if (workspace.kind === 'organization') return { organizationId: workspace.organization.id };
  return { competitionId: workspace.competition.id };
};

export type RuleCheck = (rule: PermissionRule, scope: ScopeRef | 'global' | null) => boolean;

/** Sections and items the user may see in `workspace`; empty sections drop. */
export function visibleNav(
  sections: readonly NavSection[],
  workspace: Workspace | null,
  allows: RuleCheck,
): NavSection[] {
  const kind = workspaceKind(workspace);
  const scope = workspaceScope(workspace);
  return sections
    .filter((section) => !section.workspaces || (kind !== null && section.workspaces.includes(kind)))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.requires || allows(item.requires, scope)),
    }))
    .filter((section) => section.items.length > 0);
}
