import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { I18nService } from '../../core/i18n/i18n.service';
import { auditActionLabel, formatDate, formatMoney, TbAgoPipe, TbMoneyPipe } from '../../shared/format';
import { BarChart, type BarDatum } from '../../shared/ui/bar-chart';
import { EmptyState, KpiCard } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { ClubApi } from './club.api';

/**
 * A club's home: what needs doing (overdue, expiring, unavailable courts),
 * then members, bookings, courts and money, then trends and activity.
 */
@Component({
  selector: 'tb-club-dashboard',
  imports: [RouterLink, ButtonModule, SkeletonModule, PageHeader, KpiCard, BarChart, EmptyState, TbAgoPipe, TbMoneyPipe],
  template: `
    @if (data.value(); as d) {
      <tb-page-header [title]="d.club.name" [subtitle]="t('clubDashboard.subtitle')">
        <p-button icon="pi pi-refresh" [text]="true" severity="secondary" [loading]="data.isLoading()" (onClick)="data.reload()" ariaLabel="Refresh" />
      </tb-page-header>

      <section class="tb-card pending">
        <h2 class="tb-card-title">{{ t('globalDashboard.pendingActions') }}</h2>
        @if (pending().length === 0) {
          <p class="tb-muted none">{{ t('globalDashboard.nothingPending') }}</p>
        } @else {
          <ul>
            @for (action of pending(); track action.key) {
              <li>
                <a [routerLink]="link(action.route).path" [queryParams]="link(action.route).query">
                  <span class="count">{{ action.count }}</span>
                  <span>{{ t('clubDashboard.pending.' + action.key) }}</span>
                  <i class="pi pi-arrow-right" aria-hidden="true"></i>
                </a>
              </li>
            }
          </ul>
        }
      </section>

      <section class="kpis">
        <tb-kpi-card [label]="t('clubDashboard.kpi.members')" [value]="d.members.total" [hint]="t('clubDashboard.kpi.membersHint', { active: d.members.active, expired: d.members.expired })" icon="pi pi-users" [link]="base() + '/members'" />
        <tb-kpi-card [label]="t('clubDashboard.kpi.bookingsToday')" [value]="d.bookings.today" [hint]="t('clubDashboard.kpi.bookingsHint', { count: d.bookings.next7Days })" icon="pi pi-calendar" [link]="base() + '/bookings'" />
        <tb-kpi-card [label]="t('clubDashboard.kpi.courts')" [value]="d.courts.available" [hint]="t('clubDashboard.kpi.courtsHint', { maintenance: d.courts.maintenance, disabled: d.courts.disabled })" icon="pi pi-th-large" [link]="base() + '/courts'" />
        <tb-kpi-card [label]="t('clubDashboard.kpi.tournaments')" [value]="d.tournaments.upcoming + d.tournaments.ongoing" [hint]="t('clubDashboard.kpi.tournamentsHint', { upcoming: d.tournaments.upcoming, ongoing: d.tournaments.ongoing })" icon="pi pi-trophy" />
      </section>

      <section class="money">
        <article class="tb-card figure">
          <span class="label">{{ t('clubDashboard.kpi.revenue') }}</span>
          <strong class="ok">{{ d.payments.revenueThisMonth | tbMoney }}</strong>
          <a [routerLink]="base() + '/payments'">{{ t('globalDashboard.viewAll') }}</a>
        </article>
        <article class="tb-card figure">
          <span class="label">{{ t('clubDashboard.kpi.outstanding') }}</span>
          <strong [class.due]="d.payments.outstanding > 0">{{ d.payments.outstanding | tbMoney }}</strong>
          <span class="tb-muted">{{ t('clubDashboard.kpi.outstandingHint', { count: d.payments.unpaidCount }) }}</span>
        </article>
        <article class="tb-card today">
          <h2 class="tb-card-title">{{ t('clubDashboard.today') }}</h2>
          @for (b of d.bookings.todayList; track b.id) {
            <div class="slot">
              <span class="time">{{ time(b.startTime) }}–{{ time(b.endTime) }}</span>
              <span>{{ b.court.name }}</span>
              <span class="tb-muted">{{ b.user.firstname }} {{ b.user.lastname }}</span>
            </div>
          } @empty {
            <p class="tb-muted">{{ t('clubDashboard.noBookingsToday') }}</p>
          }
        </article>
      </section>

      <section class="charts">
        <article class="tb-card">
          <h2 class="tb-card-title">{{ t('clubDashboard.revenueChart') }}</h2>
          <p class="caption">{{ t('clubDashboard.revenueCaption') }}</p>
          <tb-bar-chart [data]="revenueSeries()" [label]="t('clubDashboard.revenueChart')" [format]="money" />
        </article>
        <article class="tb-card">
          <h2 class="tb-card-title">{{ t('clubDashboard.membersChart') }}</h2>
          <p class="caption">{{ t('globalDashboard.charts.caption') }}</p>
          <tb-bar-chart [data]="membersSeries()" [label]="t('clubDashboard.membersChart')" />
        </article>
      </section>

      <section class="tb-card activity">
        <h2 class="tb-card-title">{{ t('globalDashboard.recentActivity') }}</h2>
        @for (entry of d.recentActivity; track entry.id) {
          <div class="event">
            <strong>{{ actionLabel(entry.action) }}</strong>
            <span class="tb-muted">· {{ entry.actor ? entry.actor.firstname + ' ' + entry.actor.lastname : t('audit.system') }}</span>
            <time class="tb-muted">{{ entry.createdAt | tbAgo }}</time>
          </div>
        } @empty {
          <p class="tb-muted">{{ t('list.empty') }}</p>
        }
      </section>
    } @else if (data.error()) {
      <div class="tb-card"><tb-empty-state [message]="t('list.loadError')" icon="pi pi-exclamation-triangle" /></div>
    } @else {
      <div class="kpis">
        @for (i of [1, 2, 3, 4]; track i) {
          <p-skeleton height="116px" borderRadius="14px" />
        }
      </div>
    }
  `,
  styleUrl: '../admin/global-dashboard.scss',
  styles: `
    .money { display: grid; gap: var(--tb-space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
    .figure { display: flex; flex-direction: column; gap: var(--tb-space-1); }
    .figure strong { font-size: var(--tb-text-3xl); letter-spacing: -0.02em; }
    .figure .ok { color: var(--tb-tone-success-fg); }
    .figure .due { color: var(--tb-tone-danger-fg); }
    .label { color: var(--tb-text-muted); font-weight: var(--tb-weight-medium); }
    .today { grid-column: span 1; }
    .slot { display: grid; grid-template-columns: auto 1fr auto; gap: var(--tb-space-3); padding: var(--tb-space-2) 0; border-top: 1px solid var(--tb-border); font-size: var(--tb-text-sm); }
    .slot:first-of-type { border-top: 0; }
    .time { font-variant-numeric: tabular-nums; font-weight: var(--tb-weight-semibold); }
    .event { display: flex; gap: var(--tb-space-2); padding: var(--tb-space-2) 0; border-top: 1px solid var(--tb-border); }
    .event time { margin-left: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClubDashboard {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(ClubApi);

  readonly clubId = input.required<string>();
  protected readonly data = resource({ params: () => this.clubId(), loader: ({ params }) => this.api.dashboard(params) });
  protected readonly base = computed(() => `/clubs/${this.clubId()}`);
  protected readonly pending = computed(() => (this.data.value()?.pendingActions ?? []).filter((a) => a.count > 0));

  protected readonly money = (value: number) => formatMoney(value, this.i18n.lang());

  protected readonly revenueSeries = computed<BarDatum[]>(() => {
    const lang = this.i18n.lang();
    const month = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short' });
    const long = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric' });
    return (this.data.value()?.series.revenueByMonth ?? []).map((m) => {
      const date = new Date(`${m.month}-01T00:00:00Z`);
      return { label: month.format(date), value: m.amount, title: long.format(date) };
    });
  });

  protected readonly membersSeries = computed<BarDatum[]>(() => {
    const lang = this.i18n.lang();
    const short = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit' });
    return (this.data.value()?.series.newMembers ?? []).map((p) => ({
      label: short.format(new Date(p.week)),
      value: p.count,
      title: this.t('globalDashboard.charts.week', { date: formatDate(p.week, lang, 'date') }),
    }));
  });

  /** "members?paymentStatus=OVERDUE" → router path + query. */
  protected link(route: string) {
    const [path, query = ''] = route.split('?');
    // Routes are relative to the club, except absolute ones (tournaments).
    return { path: path.startsWith('/') ? path : `${this.base()}/${path}`, query: Object.fromEntries(new URLSearchParams(query)) };
  }

  protected time(iso: string) {
    return new Date(iso).toISOString().slice(11, 16);
  }

  protected actionLabel(action: string) {
    return auditActionLabel(this.i18n, action);
  }
}
