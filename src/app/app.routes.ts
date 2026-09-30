import type { Routes } from '@angular/router';
import { authGuard, guestGuard, passwordChangeGuard, pendingGuard, permissionGuard } from './core/auth/guards';

// Every feature is lazy-loaded. Feature routes that need a permission declare
// it as `data: { permissions }` with `canMatch: [permissionGuard]`.
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/access/access-pages').then((m) => m.RegisterPage),
  },
  {
    path: 'change-password',
    canMatch: [passwordChangeGuard],
    loadComponent: () => import('./features/access/access-pages').then((m) => m.ForcedPasswordPage),
  },
  {
    path: 'pending',
    canMatch: [pendingGuard],
    loadComponent: () => import('./features/auth/pending.page').then((m) => m.PendingPage),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'users',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['user.view'] } },
        loadComponent: () => import('./features/admin/users/users-list.page').then((m) => m.UsersListPage),
      },
      {
        path: 'users/:id',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['user.view'] } },
        loadComponent: () => import('./features/admin/users/user-detail.page').then((m) => m.UserDetailPage),
      },
      {
        path: 'roles',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['role.view'] } },
        loadComponent: () => import('./features/admin/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'access-requests',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['access_request.review'] } },
        loadComponent: () =>
          import('./features/admin/access-requests/access-requests.page').then((m) => m.AccessRequestsPage),
      },
      {
        path: 'audit-logs',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['audit.view'] } },
        loadComponent: () => import('./features/admin/audit/audit-log.page').then((m) => m.AuditLogPage),
      },
      {
        path: 'access',
        loadComponent: () => import('./features/access/access-pages').then((m) => m.AccessPage),
      },
      {
        path: 'organizations',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['organization.view'] } },
        loadComponent: () => import('./features/organizations/organizations.page').then((m) => m.OrganizationsPage),
      },
      {
        path: 'organizations/:id',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['organization.view'] } },
        loadComponent: () =>
          import('./features/organizations/organization-detail.page').then((m) => m.OrganizationDetailPage),
      },
      {
        path: 'federations/:id',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['federation.view'] } },
        loadComponent: () => import('./features/organizations/federation.pages').then((m) => m.FederationProfilePage),
      },
      {
        path: 'federations/:id/clubs',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['federation.clubs.view'] } },
        loadComponent: () => import('./features/organizations/federation.pages').then((m) => m.FederationClubsPage),
      },
      {
        path: 'clubs/:id',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['club.view'] } },
        loadComponent: () => import('./features/organizations/club-profile.page').then((m) => m.ClubProfilePage),
      },
      {
        path: 'clubs/:id/courts',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['court.view'] } },
        loadComponent: () => import('./features/organizations/courts.page').then((m) => m.CourtsPage),
      },
      {
        path: 'clubs/:id/members',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['member.view'] } },
        loadComponent: () => import('./features/club/members.page').then((m) => m.MembersPage),
      },
      {
        path: 'clubs/:id/bookings',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['booking.view'] } },
        loadComponent: () => import('./features/club/bookings.page').then((m) => m.BookingsPage),
      },
      {
        path: 'clubs/:id/payments',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['payment.view'] } },
        loadComponent: () => import('./features/club/payments.page').then((m) => m.PaymentsPage),
      },
      {
        path: 'payments',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['payment.view'] } },
        loadComponent: () => import('./features/club/payments.page').then((m) => m.PaymentsPage),
      },
      {
        path: 'federations/:id/players',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['federation.players.view'] } },
        loadComponent: () => import('./features/club/federation-players.page').then((m) => m.FederationPlayersPage),
      },
      {
        path: 'tournaments',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['tournament.view'] } },
        loadComponent: () => import('./features/tournaments/tournaments.page').then((m) => m.TournamentsPage),
      },
      {
        path: 'tournaments/new',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['tournament.create'] } },
        loadComponent: () => import('./features/tournaments/tournament-wizard.page').then((m) => m.TournamentWizardPage),
      },
      {
        path: 'tournaments/:id',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['tournament.view'] } },
        loadComponent: () => import('./features/tournaments/tournament-detail.page').then((m) => m.TournamentDetailPage),
      },
      {
        path: 'tournaments/:id/:tab',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['tournament.view'] } },
        loadComponent: () => import('./features/tournaments/tournament-detail.page').then((m) => m.TournamentDetailPage),
      },
      {
        path: 'matches',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['match.view'] } },
        loadComponent: () => import('./features/tournaments/matches.page').then((m) => m.MatchesPage),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/insights/notifications.page').then((m) => m.NotificationsPage),
      },
      {
        path: 'reports',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['report.view'] } },
        loadComponent: () => import('./features/insights/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'federations/:id/rankings',
        canMatch: [permissionGuard],
        data: { permissions: { any: ['federation.rankings.view'] } },
        loadComponent: () => import('./features/insights/rankings.page').then((m) => m.RankingsPage),
      },
      {
        path: 'federations/:id/announcements',
        canMatch: [permissionGuard],
        data: { kind: 'federation', permissions: { any: ['notification.broadcast'] } },
        loadComponent: () => import('./features/insights/announcements.page').then((m) => m.AnnouncementsPage),
      },
      {
        path: 'clubs/:id/announcements',
        canMatch: [permissionGuard],
        data: { kind: 'club', permissions: { any: ['notification.broadcast'] } },
        loadComponent: () => import('./features/insights/announcements.page').then((m) => m.AnnouncementsPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'forbidden',
        data: { variant: 'forbidden' },
        loadComponent: () => import('./features/errors/error.page').then((m) => m.ErrorPage),
      },
      {
        path: '**',
        data: { variant: 'notFound' },
        loadComponent: () => import('./features/errors/error.page').then((m) => m.ErrorPage),
      },
    ],
  },
  // Signed out on an unknown URL: the auth guard above sends them to /login.
  { path: '**', redirectTo: 'login' },
];
