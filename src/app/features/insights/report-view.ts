import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { download } from '../club/club.api';
import { formatDate, formatMoney } from '../../shared/format';
import { BarChart, type BarDatum } from '../../shared/ui/bar-chart';
import { EmptyState } from '../../shared/ui/bits';
import { InsightsApi } from './insights.api';
import { REPORT_TYPES, type ColumnType, type ReportScope } from './insights.models';

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * One scope's reports (club, tournament or federation): type tabs, period,
 * a chart when the report has a series, the table with totals, CSV export.
 */
@Component({
  selector: 'tb-report-view',
  imports: [FormsModule, ButtonModule, DatePickerModule, SkeletonModule, BarChart, EmptyState],
  template: `
    <section class="tb-card head">
      <div class="types" role="tablist">
        @for (type of types(); track type) {
          <button type="button" role="tab" [attr.aria-selected]="type === current()" [class.active]="type === current()" (click)="current.set(type)">
            {{ t('reportsPage.types.' + type) }}
          </button>
        }
      </div>
      <div class="controls">
        @if (scope() !== 'tournament') {
          <p-datepicker [ngModel]="from()" (ngModelChange)="from.set($event)" dateFormat="dd/mm/yy" [showIcon]="true" [placeholder]="t('reportsPage.from')" [attr.aria-label]="t('reportsPage.from')" appendTo="body" />
          <p-datepicker [ngModel]="to()" (ngModelChange)="to.set($event)" dateFormat="dd/mm/yy" [showIcon]="true" [placeholder]="t('reportsPage.to')" [attr.aria-label]="t('reportsPage.to')" appendTo="body" />
        }
        @if (canExport()) {
          <p-button [label]="t('reportsPage.export')" icon="pi pi-download" severity="secondary" [outlined]="true" [loading]="exporting()" (onClick)="export()" />
        }
      </div>
    </section>

    @if (report.value(); as r) {
      @if (chartData().length > 1) {
        <section class="tb-card">
          <tb-bar-chart [data]="chartData()" [label]="r.chart!.label" [format]="chartFormat()" />
        </section>
      }
      <section class="tb-card table-card">
        <p class="meta tb-muted">{{ r.title }} · {{ t('reportsPage.generated', { date: generated() }) }}</p>
        @if (r.rows.length) {
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  @for (c of r.columns; track c.key) {
                    <th [class.num]="c.type !== 'text' && c.type !== 'date'" scope="col">{{ c.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of r.rows; track $index) {
                  <tr>
                    @for (c of r.columns; track c.key) {
                      <td [class.num]="c.type !== 'text' && c.type !== 'date'">{{ cell(row[c.key], c.type) }}</td>
                    }
                  </tr>
                }
              </tbody>
              @if (r.totals) {
                <tfoot>
                  <tr>
                    @for (c of r.columns; track c.key; let first = $first) {
                      <td [class.num]="!first">{{ first ? t('reportsPage.total') : r.totals[c.key] !== undefined ? cell(r.totals[c.key], c.type) : '' }}</td>
                    }
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        } @else {
          <tb-empty-state [message]="t('reportsPage.empty')" icon="pi pi-chart-bar" />
        }
      </section>
    } @else if (report.error()) {
      <div class="tb-card"><tb-empty-state [message]="t('list.loadError')" icon="pi pi-exclamation-triangle" /></div>
    } @else {
      <p-skeleton height="320px" borderRadius="14px" />
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--tb-space-3); align-items: center; padding: var(--tb-space-3) var(--tb-space-4); }
    .types { display: flex; flex-wrap: wrap; gap: var(--tb-space-1); }
    .types button { border: 1px solid var(--tb-border); background: var(--tb-surface); border-radius: var(--tb-radius-full); padding: 4px 14px; font: inherit; font-size: var(--tb-text-sm); cursor: pointer; color: var(--tb-text-muted); }
    .types button.active { background: var(--tb-primary-600); border-color: var(--tb-primary-600); color: #fff; }
    .types button:focus-visible { outline: 2px solid var(--tb-primary-500); outline-offset: 2px; }
    .controls { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); align-items: center; }
    .controls ::ng-deep p-datepicker { width: 160px; }
    .table-card { padding: 0; overflow: hidden; }
    .meta { margin: 0; padding: var(--tb-space-3) var(--tb-space-4); font-size: var(--tb-text-sm); border-bottom: 1px solid var(--tb-border); }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: var(--tb-text-sm); }
    th { text-align: left; background: var(--tb-surface-muted); color: var(--tb-text-muted); font-size: var(--tb-text-xs); text-transform: uppercase; letter-spacing: 0.04em; padding: var(--tb-space-3) var(--tb-space-4); white-space: nowrap; }
    td { padding: var(--tb-space-3) var(--tb-space-4); border-top: 1px solid var(--tb-border); }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tfoot td { font-weight: var(--tb-weight-semibold); background: var(--tb-surface-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportView {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(InsightsApi);
  private readonly toasts = inject(MessageService);

  readonly scope = input.required<ReportScope>();
  readonly subjectId = input.required<string>();
  readonly canExport = input(false);

  protected readonly types = computed(() => REPORT_TYPES[this.scope()]);
  protected readonly current = signal<string>('');
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  protected readonly exporting = signal(false);

  private readonly query = computed(() => ({
    type: this.current() || this.types()[0],
    from: this.from() ? day(this.from()!) : undefined,
    to: this.to() ? day(this.to()!) : undefined,
  }));
  protected readonly report = resource({
    params: () => ({ scope: this.scope(), id: this.subjectId(), query: this.query() }),
    loader: ({ params }) => this.api.report(params.scope, params.id, params.query),
  });

  protected readonly chartData = computed<BarDatum[]>(() =>
    (this.report.value()?.chart?.points ?? []).map((p) => ({ label: p.label.length > 10 ? `${p.label.slice(0, 9)}…` : p.label, value: p.value, title: p.label })),
  );
  protected readonly chartFormat = computed(() => {
    const type = this.report.value()?.chart?.type;
    return (v: number) => (type === 'money' ? formatMoney(v, this.i18n.lang()) : type === 'percent' ? `${v} %` : String(v));
  });
  protected readonly generated = computed(() => formatDate(this.report.value()?.generatedAt, this.i18n.lang()));

  protected cell(value: string | number | null | undefined, type: ColumnType) {
    if (value === null || value === undefined || value === '') return '—';
    if (type === 'money') return formatMoney(value, this.i18n.lang());
    if (type === 'percent') return `${value} %`;
    if (type === 'date') return formatDate(String(value), this.i18n.lang(), 'slot');
    if (type === 'number') return new Intl.NumberFormat(this.i18n.lang()).format(Number(value));
    return String(value);
  }

  protected async export() {
    this.exporting.set(true);
    try {
      download(await this.api.reportCsv(this.scope(), this.subjectId(), this.query()), `${this.query().type}-${day(new Date())}.csv`);
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    } finally {
      this.exporting.set(false);
    }
  }
}
