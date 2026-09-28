import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { I18nService } from '../../core/i18n/i18n.service';
import { auditActionLabel, formatDate, TbAgoPipe } from '../../shared/format';
import { BarChart, type BarDatum } from '../../shared/ui/bar-chart';
import { EmptyState, KpiCard } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { AdminApi } from './admin.api';

/**
 * Super Admin dashboard: what needs doing first, then the platform's
 * figures, then trends and recent activity. Everything comes from
 * GET /admin/dashboard.
 */
@Component({
  selector: 'tb-global-dashboard',
  imports: [RouterLink, ButtonModule, SkeletonModule, PageHeader, KpiCard, BarChart, EmptyState, TbAgoPipe],
  templateUrl: './global-dashboard.html',
  styleUrl: './global-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalDashboard {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(AdminApi);

  protected readonly data = resource({ loader: () => this.api.dashboard() });

  protected readonly pending = computed(() => (this.data.value()?.pendingActions ?? []).filter((a) => a.count > 0));

  protected readonly usersSeries = computed(() => this.series(this.data.value()?.series.newUsers));
  protected readonly bookingsSeries = computed(() => this.series(this.data.value()?.series.bookingsMade));

  protected actionLabel(action: string) {
    return auditActionLabel(this.i18n, action);
  }

  private series(points: { week: string; count: number }[] | undefined): BarDatum[] {
    const lang = this.i18n.lang();
    const short = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit' });
    return (points ?? []).map((p) => ({
      label: short.format(new Date(p.week)),
      value: p.count,
      title: this.t('globalDashboard.charts.week', { date: formatDate(p.week, lang, 'date') }),
    }));
  }
}
