import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { I18nService } from '../../../core/i18n/i18n.service';
import { injectListQuery } from '../../../shared/data/list-query';
import { auditActionLabel, TbDatePipe } from '../../../shared/format';
import { EmptyState } from '../../../shared/ui/bits';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchInput } from '../../../shared/ui/search-input';
import { AdminApi } from '../admin.api';
import type { AuditEntry } from '../admin.models';

interface ChangeRow {
  field: string;
  before: string;
  after: string;
  changed: boolean;
}

const show = (value: unknown): string =>
  value === undefined ? '' : value === null ? '∅' : typeof value === 'object' ? JSON.stringify(value) : String(value);

/** Field-by-field before/after of an audit entry. */
export function changeRows(before: unknown, after: unknown): ChangeRow[] {
  const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : v === null || v === undefined ? {} : { value: v };
  const b = asRecord(before);
  const a = asRecord(after);
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return fields.map((field) => ({
    field,
    before: show(b[field]),
    after: show(a[field]),
    changed: JSON.stringify(b[field]) !== JSON.stringify(a[field]),
  }));
}

/** ISO date (yyyy-mm-dd) of a Date in local time, for the URL. */
const isoDay = (date: Date | null) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;

@Component({
  selector: 'tb-audit-log-page',
  imports: [FormsModule, ButtonModule, DatePickerModule, DrawerModule, SelectModule, TableModule, PageHeader, SearchInput, EmptyState, TbDatePipe],
  templateUrl: './audit-log.page.html',
  styleUrls: ['../admin-list.scss', './audit-log.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly api = inject(AdminApi);

  protected readonly list = injectListQuery(['action', 'entityType', 'from', 'to'], { pageSize: 50 });
  /** The API wants instants: "to" covers the whole selected day. */
  private readonly apiQuery = computed(() => {
    const query = this.list.query();
    const { from, to } = query.filters;
    return {
      ...query,
      filters: {
        ...query.filters,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      },
    };
  });
  protected readonly logs = resource({ params: () => this.apiQuery(), loader: ({ params }) => this.api.auditLogs(params) });
  protected readonly page = linkedSignal<ReturnType<typeof this.logs.value>, ReturnType<typeof this.logs.value>>({
    source: () => this.logs.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly facets = resource({ loader: () => this.api.auditFacets() });
  protected readonly actionOptions = computed(() =>
    (this.facets.value()?.actions ?? []).map((action) => ({ label: this.actionLabel(action), value: action })),
  );
  protected readonly entityOptions = computed(() =>
    (this.facets.value()?.entityTypes ?? []).map((type) => ({ label: type, value: type })),
  );
  protected readonly fromDate = computed(() => (this.list.query().filters['from'] ? new Date(`${this.list.query().filters['from']}T00:00:00`) : null));
  protected readonly toDate = computed(() => (this.list.query().filters['to'] ? new Date(`${this.list.query().filters['to']}T00:00:00`) : null));

  protected readonly selected = signal<AuditEntry | null>(null);
  protected readonly changes = computed(() => {
    const entry = this.selected();
    return entry ? changeRows(entry.before, entry.after) : [];
  });

  protected actionLabel(action: string) {
    return auditActionLabel(this.i18n, action);
  }

  protected setDate(key: 'from' | 'to', date: Date | null) {
    void this.list.update({ [key]: isoDay(date) });
  }
}
