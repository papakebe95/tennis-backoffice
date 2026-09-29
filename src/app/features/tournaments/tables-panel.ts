import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService } from '../../shared/ui/confirm';
import { EmptyState } from '../../shared/ui/bits';
import { StatusBadge } from '../../shared/ui/status-badge';
import { EventForm, type TableOption } from './event-form';
import { TableSummary } from './table-summary';
import { TournamentApi } from './tournament.api';
import { DEFAULT_EVENT, type EventInput, type TableIssue, type TournamentDetail, type TournamentEvent } from './tournament.models';
import type { TournamentCan } from './tournament-detail.page';

const toInput = (e: TournamentEvent): EventInput => ({
  name: e.name,
  discipline: e.discipline,
  gender: e.gender,
  ageMin: e.ageMin,
  ageMax: e.ageMax,
  minClassificationId: e.minClassificationId,
  maxClassificationId: e.maxClassificationId,
  format: e.format,
  maxEntries: e.maxEntries,
  entryFee: e.entryFee === null ? null : Number(e.entryFee),
  seedCount: e.seedCount,
  bestOf: e.bestOf,
  gamesPerSet: e.gamesPerSet,
  finalSet: e.finalSet,
  noAd: e.noAd,
  matchDurationMinutes: e.matchDurationMinutes,
  qualifiesIntoEventId: e.qualifiesIntoEventId,
  qualifierCount: e.qualifierCount,
  tableOrder: e.tableOrder,
});

/** The "Tables" tab: each table's eligibility, rules and where it qualifies. */
@Component({
  selector: 'tb-tables-panel',
  imports: [ButtonModule, DrawerModule, MessageModule, EmptyState, StatusBadge, EventForm, TableSummary],
  template: `
    @let d = tournament();
    @if (d.tableIssues.length) {
      <p-message severity="warn" class="msg">
        <ul>
          @for (issue of d.tableIssues; track $index) {
            <li><strong>{{ nameOf(issue.eventId) }}</strong> — {{ t('tournaments.tables.issues.' + issue.code) }}</li>
          }
        </ul>
      </p-message>
    }
    @if (canEdit()) {
      <div class="toolbar">
        <p-button [label]="t('tournaments.tables.add')" icon="pi pi-plus" (onClick)="openNew()" />
      </div>
    }

    @for (e of d.events; track e.id) {
      <article class="tb-card table">
        <header>
          <div class="title">
            <h2>{{ e.name }}</h2>
            <tb-status-badge kind="draw" [value]="e.drawStatus" />
          </div>
          @if (canEdit()) {
            <div class="actions">
              <p-button [label]="t('tournaments.tables.edit')" icon="pi pi-pencil" severity="secondary" [text]="true" (onClick)="openEdit(e)" />
              <p-button icon="pi pi-trash" severity="danger" [text]="true" [ariaLabel]="t('tournaments.tables.delete')" (onClick)="remove(e)" />
            </div>
          }
        </header>
        <tb-table-summary [event]="e" [classifications]="scale()" [targetName]="e.qualifiesIntoEvent?.name ?? null" />
        <dl class="counts">
          <div><dt>{{ t('tournaments.tables.counts.approved') }}</dt><dd>{{ e.maxEntries ? t('tournaments.tables.places', { count: e.entries.APPROVED, max: e.maxEntries }) : e.entries.APPROVED }}</dd></div>
          <div><dt>{{ t('tournaments.tables.counts.pending') }}</dt><dd>{{ e.entries.PENDING }}</dd></div>
          <div><dt>{{ t('tournaments.tables.counts.waitlisted') }}</dt><dd>{{ e.entries.WAITLISTED }}</dd></div>
          @if (fedBy(e.id); as count) {
            <div class="accent"><dt>{{ t('tournaments.tables.fedBy', { count }) }}</dt><dd>{{ e.qualifiersEntered }} / {{ count }}</dd></div>
          }
        </dl>
      </article>
    } @empty {
      <div class="tb-card"><tb-empty-state [message]="t('tournaments.tables.empty')" icon="pi pi-sitemap" /></div>
    }

    <p-drawer [(visible)]="drawerOpen" position="right" styleClass="tb-drawer tb-drawer-lg" [header]="editing() ? t('tournaments.eventForm.titleEdit') : t('tournaments.eventForm.titleNew')">
      @if (error()) {
        <p-message severity="error" class="msg">
          <div>
            {{ error() }}
            @for (issue of issues(); track $index) {
              <div>{{ nameOf(issue.eventId) }} — {{ t('tournaments.tables.issues.' + issue.code) }}</div>
            }
          </div>
        </p-message>
      }
      @if (form(); as f) {
        <tb-event-form [value]="f" (valueChange)="form.set($event)" [classifications]="scale()" [tables]="targets()" [drawLocked]="drawLocked()" idPrefix="edit" />
      }
      <ng-template #footer>
        <div class="drawer-footer">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="drawerOpen.set(false)" />
          <p-button [label]="t('common.save')" icon="pi pi-check" [loading]="saving()" [disabled]="(form()?.name?.trim()?.length ?? 0) < 2" (onClick)="save()" />
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); }
    .msg { display: block; }
    .msg ul { margin: 0; padding-left: var(--tb-space-5); }
    .toolbar { display: flex; justify-content: flex-end; }
    .table { display: grid; gap: var(--tb-space-3); }
    .table header { display: flex; align-items: center; justify-content: space-between; gap: var(--tb-space-3); flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: var(--tb-space-3); }
    h2 { font-size: var(--tb-text-lg); margin: 0; }
    .actions { display: flex; gap: var(--tb-space-1); }
    .counts { display: flex; flex-wrap: wrap; gap: var(--tb-space-6); margin: 0; }
    .counts div { display: grid; gap: 2px; }
    .counts dt { font-size: var(--tb-text-xs); color: var(--tb-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .counts dd { margin: 0; font-weight: var(--tb-weight-semibold); font-variant-numeric: tabular-nums; }
    .counts .accent dt { color: var(--tb-primary-700); }
    .drawer-footer { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesPanel {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly tournament = input.required<TournamentDetail>();
  readonly can = input.required<TournamentCan>();
  readonly changed = output<void>();

  private readonly classifications = resource({ loader: () => this.api.classifications() });
  protected readonly scale = computed(() => this.classifications.value() ?? []);
  protected readonly canEdit = computed(() => this.tournament().editable && this.can()('tournament.update'));

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<TournamentEvent | null>(null);
  protected readonly form = signal<EventInput | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly issues = signal<TableIssue[]>([]);

  protected readonly drawLocked = computed(() => !!this.editing() && this.editing()!.drawStatus !== 'NOT_GENERATED');
  /** Tables the edited one may qualify into: any other (the API checks the order). */
  protected readonly targets = computed<TableOption[]>(() =>
    this.tournament()
      .events.filter((e) => e.id !== this.editing()?.id)
      .map((e) => ({ value: e.id, label: e.name })),
  );

  protected nameOf(eventId: string) {
    return this.tournament().events.find((e) => e.id === eventId)?.name ?? '';
  }

  protected fedBy(eventId: string) {
    return this.tournament()
      .events.filter((e) => e.qualifiesIntoEventId === eventId)
      .reduce((sum, e) => sum + e.qualifierCount, 0);
  }

  protected openNew() {
    const order = Math.max(-1, ...this.tournament().events.map((e) => e.tableOrder)) + 1;
    this.editing.set(null);
    this.form.set({ ...DEFAULT_EVENT, tableOrder: order });
    this.error.set(null);
    this.issues.set([]);
    this.drawerOpen.set(true);
  }

  protected openEdit(event: TournamentEvent) {
    this.editing.set(event);
    this.form.set(toInput(event));
    this.error.set(null);
    this.issues.set([]);
    this.drawerOpen.set(true);
  }

  protected async save() {
    const form = this.form();
    if (!form) return;
    this.saving.set(true);
    this.error.set(null);
    this.issues.set([]);
    try {
      const editing = this.editing();
      const body = { ...form, name: form.name.trim() };
      if (editing) await this.api.updateEvent(editing.id, body);
      else await this.api.createEvent(this.tournament().id, body);
      this.drawerOpen.set(false);
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.tables.saved') });
      this.changed.emit();
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error.set(describeError(error, this.t));
      if (error.code === 'TABLES_INVALID') this.issues.set(error.issues as TableIssue[]);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(event: TournamentEvent) {
    const answer = await this.confirm.ask({
      title: this.t('tournaments.tables.deleteTitle'),
      message: this.t('tournaments.tables.deleteMessage', { name: event.name }),
      confirmLabel: this.t('tournaments.tables.delete'),
      severity: 'danger',
    });
    if (!answer) return;
    try {
      await this.api.removeEvent(event.id);
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.tables.deleted') });
      this.changed.emit();
    } catch (raw) {
      this.toasts.add({ severity: 'error', summary: describeError(ApiError.from(raw), this.t) });
    }
  }
}
