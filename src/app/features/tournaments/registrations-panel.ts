import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe } from '../../shared/format';
import { EmptyState, UserCell } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { SearchInput } from '../../shared/ui/search-input';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AddEntryDrawer } from './add-entry-drawer';
import { TournamentApi } from './tournament.api';
import {
  DECISIONS_FROM,
  ENTRY_TYPES,
  entriesOpen,
  REGISTRATION_STATUSES,
  type Decision,
  type EligibilityIssue,
  type Registration,
  type TournamentDetail,
} from './tournament.models';
import type { TournamentCan } from './tournament-detail.page';

/** The "Entries" tab: one table's registrations, decisions and seeds. */
@Component({
  selector: 'tb-registrations-panel',
  imports: [FormsModule, ButtonModule, MessageModule, SelectModule, TableModule, TooltipModule, EmptyState, UserCell, SearchInput, StatusBadge, TbDatePipe, AddEntryDrawer],
  template: `
    @let d = tournament();
    @if (!d.events.length) {
      <div class="tb-card"><tb-empty-state [message]="t('tournaments.registrations.noEvents')" icon="pi pi-sitemap" /></div>
    } @else {
      @if (!open()) {
        <p-message severity="info" class="msg">{{ t('tournaments.registrations.closed') }}</p-message>
      }
      <div class="tb-card list-card">
        <div class="filters">
          <p-select
            [options]="eventOptions()"
            [ngModel]="eventId()"
            (ngModelChange)="list.update({ event: $event, status: null })"
            [attr.aria-label]="t('tournaments.registrations.event')"
            styleClass="event-select"
          />
          <tb-search-input [value]="list.query().q" [placeholder]="t('tournaments.registrations.searchPlaceholder')" (search)="list.update({ q: $event })" />
          <p-select [options]="entryTypeOptions()" [ngModel]="list.query().filters['entryType'] ?? null" (ngModelChange)="list.update({ entryType: $event })" [placeholder]="t('tournaments.registrations.columns.entryType')" [showClear]="true" [attr.aria-label]="t('tournaments.registrations.columns.entryType')" />
          <span class="total">{{ capacityText() }}</span>
          @if (canManage()) {
            <p-button [label]="t('tournaments.registrations.add')" icon="pi pi-user-plus" (onClick)="addOpen.set(true)" />
          }
        </div>
        <div class="status-chips" role="group" [attr.aria-label]="t('tournaments.columns.status')">
          <button type="button" [class.active]="!list.query().filters['status']" (click)="list.update({ status: null })">
            {{ t('list.all') }} <span>{{ totalCount() }}</span>
          </button>
          @for (s of statuses; track s) {
            <button type="button" [class.active]="list.query().filters['status'] === s" (click)="list.update({ status: s })">
              {{ t('status.registration.' + s) }} <span>{{ page()?.counts?.[s] ?? 0 }}</span>
            </button>
          }
        </div>
        <p-table
          [value]="page()?.items ?? []"
          [lazy]="true"
          [loading]="registrations.isLoading()"
          [paginator]="(page()?.total ?? 0) > list.query().pageSize"
          [rows]="list.query().pageSize"
          [first]="list.first()"
          [totalRecords]="page()?.total ?? 0"
          sortMode="multiple"
          [multiSortMeta]="list.sortMeta()"
          (onLazyLoad)="list.onLazyLoad($event)"
          (onSort)="list.onSort($event)"
          dataKey="id"
          [rowHover]="true"
          styleClass="tb-table"
        >
          <ng-template #header>
            <tr>
              <th>{{ t('tournaments.registrations.columns.player') }}</th>
              <th>{{ t('tournaments.registrations.columns.classification') }}</th>
              <th>{{ t('tournaments.registrations.columns.entryType') }}</th>
              <th pSortableColumn="registeredAt">{{ t('tournaments.registrations.columns.registered') }} <p-sorticon field="registeredAt" /></th>
              <th pSortableColumn="seed">{{ t('tournaments.registrations.columns.seed') }} <p-sorticon field="seed" /></th>
              <th>{{ t('tournaments.registrations.columns.eligibility') }}</th>
              <th>{{ t('tournaments.registrations.columns.status') }}</th>
              @if (canManage()) {
                <th><span class="tb-sr-only">Actions</span></th>
              }
            </tr>
          </ng-template>
          <ng-template #body let-r>
            <tr>
              <td>
                <tb-user-cell [firstname]="r.player.firstname" [lastname]="r.partner ? r.player.lastname + ' / ' + r.partner.firstname + ' ' + r.partner.lastname : r.player.lastname" [secondary]="playerMeta(r)" />
              </td>
              <td class="mono">{{ r.player.classification?.code ?? 'NC' }}{{ r.partner ? ' / ' + (r.partner.classification?.code ?? 'NC') : '' }}</td>
              <td>
                {{ t('tournaments.entryTypes.' + r.entryType) }}
                @if (r.sourceEvent) {
                  <small class="tb-muted block">{{ t('tournaments.registrations.from', { name: r.sourceEvent.name }) }}</small>
                }
              </td>
              <td class="mono tb-muted">{{ r.registeredAt | tbDate: 'date' }}</td>
              <td>
                @if (r.status === 'APPROVED' && canManage()) {
                  <p-select [options]="seedOptions()" [ngModel]="r.seed" (ngModelChange)="setSeed(r, $event)" [showClear]="true" placeholder="—" [attr.aria-label]="t('tournaments.registrations.seed')" styleClass="seed-select" appendTo="body" />
                } @else {
                  <span class="mono">{{ r.seed ?? '—' }}</span>
                }
              </td>
              <td>
                @if (r.issues.length) {
                  <span class="issues">
                    @for (issue of r.issues; track issue) {
                      <span class="issue">{{ t('tournaments.issues.' + issue) }}</span>
                    }
                  </span>
                  @if (r.eligibility?.override) {
                    <small class="tb-muted block">{{ t('tournaments.registrations.overridden', { reason: r.eligibility.override }) }}</small>
                  }
                } @else {
                  <span class="ok"><i class="pi pi-check" aria-hidden="true"></i> {{ t('tournaments.registrations.eligible') }}</span>
                }
              </td>
              <td>
                <tb-status-badge kind="registration" [value]="r.status" />
                @if (r.rejectionReason) {
                  <small class="tb-muted block" [pTooltip]="r.rejectionReason">{{ t('tournaments.registrations.rejectedBecause', { reason: r.rejectionReason }) }}</small>
                }
              </td>
              @if (canManage()) {
                <td class="row-actions">
                  @for (decision of decisionsFor(r); track decision) {
                    <p-button
                      [icon]="decisionIcon[decision]"
                      [severity]="decisionSeverity[decision]"
                      [text]="true"
                      [rounded]="true"
                      size="small"
                      [pTooltip]="t('tournaments.registrations.actions.' + decision)"
                      tooltipPosition="left"
                      [ariaLabel]="t('tournaments.registrations.actions.' + decision)"
                      [disabled]="busy() === r.id"
                      (onClick)="decide(r, decision)"
                    />
                  }
                </td>
              }
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td [attr.colspan]="canManage() ? 8 : 7"><tb-empty-state [message]="list.hasFilters() ? t('list.emptyFiltered') : t('list.empty')" icon="pi pi-users" /></td></tr>
          </ng-template>
        </p-table>
      </div>

      @if (eventId(); as id) {
        <tb-add-entry-drawer [tournament]="d" [eventId]="id" [(visible)]="addOpen" (added)="refresh()" />
      }
    }
  `,
  styleUrl: '../admin/admin-list.scss',
  styles: `
    :host { display: grid; gap: var(--tb-space-4); }
    .msg { display: block; }
    :host ::ng-deep .event-select { min-width: 260px; font-weight: var(--tb-weight-semibold); }
    :host ::ng-deep .seed-select { width: 84px; }
    .status-chips { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); padding: var(--tb-space-3) var(--tb-space-5); border-bottom: 1px solid var(--tb-border); }
    .status-chips button {
      border: 1px solid var(--tb-border); background: var(--tb-surface); color: var(--tb-text-muted); border-radius: var(--tb-radius-full);
      padding: 4px 12px; font: inherit; font-size: var(--tb-text-sm); cursor: pointer; display: inline-flex; gap: 6px; align-items: center;
    }
    .status-chips button span { font-variant-numeric: tabular-nums; font-weight: var(--tb-weight-semibold); }
    .status-chips button.active { background: var(--tb-primary-50); border-color: var(--tb-primary-300); color: var(--tb-primary-800); }
    .status-chips button:focus-visible { outline: 2px solid var(--tb-primary-500); outline-offset: 2px; }
    .block { display: block; }
    .issues { display: flex; flex-wrap: wrap; gap: 4px; }
    .issue { font-size: var(--tb-text-xs); padding: 1px 8px; border-radius: var(--tb-radius-full); background: var(--tb-tone-danger-bg); color: var(--tb-tone-danger-fg); white-space: nowrap; }
    .ok { color: var(--tb-tone-success-fg); font-size: var(--tb-text-sm); white-space: nowrap; }
    .row-actions { white-space: nowrap; text-align: right; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationsPanel {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly tournament = input.required<TournamentDetail>();
  readonly can = input.required<TournamentCan>();
  readonly changed = output<void>();

  protected readonly statuses = REGISTRATION_STATUSES;
  protected readonly list = injectListQuery(['event', 'status', 'entryType'], { pageSize: 50, sort: 'registeredAt:asc' });
  /** The table shown: from the URL, else the first one. */
  protected readonly eventId = computed(() => {
    const events = this.tournament().events;
    const wanted = this.list.query().filters['event'];
    return events.find((e) => e.id === wanted)?.id ?? events[0]?.id ?? null;
  });
  protected readonly event = computed(() => this.tournament().events.find((e) => e.id === this.eventId()) ?? null);

  protected readonly registrations = resource({
    params: () => {
      const id = this.eventId();
      const q = this.list.query();
      return id ? { id, query: { ...q, filters: { status: q.filters['status'], entryType: q.filters['entryType'] } } } : undefined;
    },
    loader: ({ params }) => this.api.registrations(params.id, params.query),
  });
  protected readonly page = linkedSignal<ReturnType<typeof this.registrations.value>, ReturnType<typeof this.registrations.value>>({
    source: () => this.registrations.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly open = computed(() => entriesOpen(this.tournament().status));
  protected readonly canManage = computed(() => this.open() && this.can()('registration.manage'));
  protected readonly addOpen = signal(false);
  protected readonly busy = signal<string | null>(null);

  protected readonly eventOptions = computed(() => this.tournament().events.map((e) => ({ label: e.name, value: e.id })));
  protected readonly entryTypeOptions = computed(() => ENTRY_TYPES.map((v) => ({ label: this.t(`tournaments.entryTypes.${v}`), value: v })));
  protected readonly seedOptions = computed(() => {
    const max = Math.max(this.event()?.seedCount ?? 0, 8);
    return Array.from({ length: max }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
  });
  protected readonly totalCount = computed(() => Object.values(this.page()?.counts ?? {}).reduce((a, b) => a + b, 0));
  protected readonly capacityText = computed(() => {
    const approved = this.page()?.counts.APPROVED ?? 0;
    const max = this.event()?.maxEntries;
    return max
      ? this.t('tournaments.registrations.places', { approved, max })
      : this.t('tournaments.registrations.placesUnlimited', { approved });
  });

  protected readonly decisionIcon: Record<Decision, string> = {
    approve: 'pi pi-check',
    waitlist: 'pi pi-hourglass',
    reject: 'pi pi-times',
    withdraw: 'pi pi-sign-out',
  };
  protected readonly decisionSeverity: Record<Decision, 'success' | 'secondary' | 'danger' | 'warn'> = {
    approve: 'success',
    waitlist: 'secondary',
    reject: 'danger',
    withdraw: 'warn',
  };

  protected decisionsFor(r: Registration): Decision[] {
    return (['approve', 'waitlist', 'reject', 'withdraw'] as Decision[]).filter((d) => DECISIONS_FROM[d].includes(r.status));
  }

  protected playerMeta(r: Registration) {
    const p = r.player;
    const parts = [p.phone];
    if (p.age !== null) parts.push(this.t('tournaments.registrations.age', { age: p.age }));
    if (p.gender) parts.push(this.t(`sportProfile.genders.${p.gender}`));
    return parts.join(' · ');
  }

  protected refresh() {
    this.registrations.reload();
    this.changed.emit();
  }

  protected async decide(r: Registration, decision: Decision, overrideIssues?: EligibilityIssue[]): Promise<void> {
    const name = `${r.player.firstname} ${r.player.lastname}`;
    let reason: string | undefined;
    let overrideReason: string | undefined;
    const issues = overrideIssues ?? (decision === 'approve' ? r.issues : []);
    if (decision === 'approve' && issues.length) {
      const answer = await this.confirm.ask({
        title: this.t('tournaments.registrations.overrideTitle'),
        message: this.t('tournaments.registrations.overrideMessage', {
          name,
          issues: issues.map((i) => this.t(`tournaments.issues.${i}`)).join(', '),
        }),
        confirmLabel: this.t('tournaments.registrations.overrideConfirm'),
        severity: 'warn',
        reason: 'required',
        reasonLabel: this.t('tournaments.registrations.overrideLabel'),
      });
      if (!answer) return;
      overrideReason = answer.reason;
    } else if (decision !== 'approve') {
      const answer = await this.confirm.ask({
        title: this.t(`tournaments.registrations.${decision === 'reject' ? 'rejectTitle' : decision === 'withdraw' ? 'withdrawTitle' : 'waitlistTitle'}`),
        message: name,
        confirmLabel: this.t(`tournaments.registrations.actions.${decision}`),
        severity: decision === 'waitlist' ? 'primary' : 'danger',
        reason: decision === 'waitlist' ? 'none' : 'required',
        reasonLabel: this.t('tournaments.registrations.reasonLabel'),
      });
      if (!answer) return;
      reason = answer.reason;
    }

    this.busy.set(r.id);
    try {
      await this.api.decide(r.id, decision, { reason, overrideReason });
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.registrations.done') });
      this.refresh();
    } catch (raw) {
      const error = ApiError.from(raw);
      // The profile changed since the list loaded: ask for an override now.
      if (error.code === 'NOT_ELIGIBLE' && !overrideReason) {
        this.busy.set(null);
        return this.decide(r, decision, error.issues as EligibilityIssue[]);
      }
      this.toasts.add({ severity: 'error', summary: describeError(error, this.t) });
    } finally {
      this.busy.set(null);
    }
  }

  protected async setSeed(r: Registration, seed: number | null) {
    try {
      await this.api.setSeed(r.id, seed ?? null);
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.registrations.seedSaved') });
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    }
    this.registrations.reload();
  }
}
