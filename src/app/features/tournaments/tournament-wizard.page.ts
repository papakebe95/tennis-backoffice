import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ApiError } from '../../core/api/api';
import { WorkspaceStore } from '../../core/context/workspace.store';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbDatePipe } from '../../shared/format';
import { PageHeader } from '../../shared/ui/page-header';
import { EventForm, type TableOption } from './event-form';
import { TableSummary } from './table-summary';
import { TournamentApi } from './tournament.api';
import { DEFAULT_EVENT, type Classification, type EventInput, type TableIssue } from './tournament.models';
import {
  emptyTournamentForm,
  toTournamentInput,
  TournamentFields,
  tournamentFormErrors,
  type TournamentFormValue,
} from './tournament-fields';

interface TableDraft {
  key: string;
  value: EventInput;
  open: boolean;
}

const INDEPENDENT = 'independent';
let draftKeys = 0;
const draft = (value: Partial<EventInput>, open = false): TableDraft => ({
  key: `t${++draftKeys}`,
  value: { ...DEFAULT_EVENT, ...value },
  open,
});

/** /tournaments/new — a tournament is created as a draft with its tables. */
@Component({
  selector: 'tb-tournament-wizard-page',
  imports: [FormsModule, RouterLink, ButtonModule, MessageModule, SelectModule, PageHeader, TournamentFields, EventForm, TableSummary, TbDatePipe],
  template: `
    <a class="back" routerLink="/tournaments"><i class="pi pi-arrow-left" aria-hidden="true"></i> {{ t('tournaments.back') }}</a>
    <tb-page-header [title]="t('tournaments.wizard.title')" [subtitle]="t('tournaments.wizard.subtitle')" />

    <ol class="steps" [attr.aria-label]="t('tournaments.wizard.title')">
      @for (s of steps; track s; let i = $index) {
        <li [class.current]="step() === i" [class.done]="step() > i" [attr.aria-current]="step() === i ? 'step' : null">
          <span class="dot">{{ step() > i ? '✓' : i + 1 }}</span>
          {{ t('tournaments.wizard.steps.' + s) }}
        </li>
      }
    </ol>

    @if (error()) {
      <p-message severity="error" class="msg">
        <div>
          {{ error() }}
          @if (issues().length) {
            <ul>
              @for (issue of issues(); track $index) {
                <li>
                  @if (tableName(issue.eventId); as name) {
                    <strong>{{ name }}</strong> —
                  }
                  {{ t('tournaments.tables.issues.' + issue.code) }}
                </li>
              }
            </ul>
          }
        </div>
      </p-message>
    }

    @switch (step()) {
      @case (0) {
        <section class="tb-card">
          <div class="tb-field host">
            <label for="wz-host">{{ t('tournaments.form.host') }}</label>
            <p-select inputId="wz-host" [options]="hostOptions()" [ngModel]="host()" (ngModelChange)="host.set($event)" optionLabel="label" optionValue="value" [filter]="hostOptions().length > 8" appendTo="body" [fluid]="true" [loading]="hosts.isLoading()" />
          </div>
          <tb-tournament-fields [(value)]="info" />
        </section>
      }
      @case (1) {
        <section class="tb-card presets">
          <span class="tb-muted">{{ t('tournaments.wizard.presets') }}</span>
          <p-button [label]="t('tournaments.wizard.presetSimple')" icon="pi pi-stop" severity="secondary" [outlined]="true" size="small" (onClick)="preset('simple')" />
          <p-button [label]="t('tournaments.wizard.presetSuccessive')" icon="pi pi-sitemap" severity="secondary" [outlined]="true" size="small" (onClick)="preset('successive')" [disabled]="!scale().length" />
          <p-button [label]="t('tournaments.wizard.presetLadies')" icon="pi pi-plus" severity="secondary" [text]="true" size="small" (onClick)="preset('ladies')" />
        </section>

        @for (table of tables(); track table.key; let i = $index) {
          <section class="tb-card table">
            <header>
              <button type="button" class="toggle" (click)="toggle(i)" [attr.aria-expanded]="table.open">
                <i [class]="table.open ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true"></i>
                <strong>{{ table.value.name || t('tournaments.eventForm.titleNew') }}</strong>
              </button>
              <p-button icon="pi pi-trash" [text]="true" severity="danger" [ariaLabel]="t('tournaments.eventForm.remove')" (onClick)="removeTable(i)" />
            </header>
            @if (table.open) {
              <tb-event-form [value]="table.value" (valueChange)="setTable(i, $event)" [classifications]="scale()" [tables]="targetsFor(i)" [idPrefix]="table.key" />
            } @else {
              <tb-table-summary [event]="table.value" [classifications]="scale()" [targetName]="targetName(table.value.qualifiesIntoEventId)" />
            }
          </section>
        } @empty {
          <div class="tb-card empty tb-muted">{{ t('tournaments.wizard.noTables') }}</div>
        }
        <div>
          <p-button [label]="t('tournaments.wizard.addTable')" icon="pi pi-plus" severity="secondary" [outlined]="true" (onClick)="addTable()" />
        </div>
      }
      @case (2) {
        <section class="tb-card review">
          <h2 class="tb-card-title">{{ info().name }}</h2>
          <dl>
            <dt>{{ t('tournaments.form.host') }}</dt>
            <dd>{{ hostLabel() }}</dd>
            <dt>{{ t('tournaments.columns.dates') }}</dt>
            <dd>{{ info().startDate?.toISOString() | tbDate: 'date' }} → {{ info().endDate?.toISOString() | tbDate: 'date' }}</dd>
            @if (info().registrationClosesAt) {
              <dt>{{ t('tournaments.form.registrationCloses') }}</dt>
              <dd>{{ info().registrationClosesAt?.toISOString() | tbDate: 'date' }}</dd>
            }
            <dt>{{ t('tournaments.form.visibility') }}</dt>
            <dd>{{ t('tournaments.form.visibilities.' + info().visibility) }}</dd>
          </dl>
          <h3>{{ t('tournaments.wizard.summary', { count: tables().length }) }}</h3>
          @for (table of tables(); track table.key) {
            <div class="review-table">
              <strong>{{ table.value.name }}</strong>
              <tb-table-summary [event]="table.value" [classifications]="scale()" [targetName]="targetName(table.value.qualifiesIntoEventId)" />
            </div>
          }
        </section>
      }
    }

    <footer class="nav">
      @if (step() > 0) {
        <p-button [label]="t('tournaments.wizard.previous')" icon="pi pi-arrow-left" severity="secondary" [text]="true" (onClick)="step.set(step() - 1)" />
      }
      <span class="spacer"></span>
      @if (step() < 2) {
        <p-button [label]="t('tournaments.wizard.next')" icon="pi pi-arrow-right" iconPos="right" [disabled]="!stepValid()" (onClick)="step.set(step() + 1)" />
      } @else {
        <p-button [label]="t('tournaments.wizard.create')" icon="pi pi-check" [loading]="saving()" (onClick)="create()" />
      }
    </footer>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); max-width: 920px; }
    .back { display: inline-flex; align-items: center; gap: var(--tb-space-2); color: var(--tb-text-muted); text-decoration: none; font-weight: var(--tb-weight-medium); }
    tb-page-header { margin-bottom: calc(-1 * var(--tb-space-4)); }
    .steps { list-style: none; margin: 0; padding: 0; display: flex; gap: var(--tb-space-6); flex-wrap: wrap; }
    .steps li { display: flex; align-items: center; gap: var(--tb-space-2); color: var(--tb-text-muted); font-weight: var(--tb-weight-medium); }
    .steps .dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--tb-surface-muted); border: 1px solid var(--tb-border); font-size: var(--tb-text-sm); }
    .steps li.current { color: var(--tb-text); }
    .steps li.current .dot { background: var(--tb-primary-600); border-color: var(--tb-primary-600); color: #fff; }
    .steps li.done .dot { background: var(--tb-primary-50); border-color: var(--tb-primary-200); color: var(--tb-primary-700); }
    .msg { display: block; }
    .msg ul { margin: var(--tb-space-2) 0 0; padding-left: var(--tb-space-5); }
    .host { max-width: 420px; }
    .presets { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); align-items: center; }
    .table { display: grid; gap: var(--tb-space-3); }
    .table header { display: flex; align-items: center; justify-content: space-between; }
    .toggle { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: var(--tb-space-2); }
    .toggle:focus-visible { outline: 2px solid var(--tb-primary-500); outline-offset: 2px; border-radius: var(--tb-radius-sm); }
    .empty { text-align: center; }
    .review dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--tb-space-2) var(--tb-space-6); margin: 0 0 var(--tb-space-4); }
    .review dt { color: var(--tb-text-muted); }
    .review dd { margin: 0; }
    .review h3 { font-size: var(--tb-text-md); margin: var(--tb-space-2) 0; }
    .review-table { padding: var(--tb-space-3) 0; border-top: 1px solid var(--tb-border); display: grid; gap: var(--tb-space-1); }
    .nav { display: flex; align-items: center; gap: var(--tb-space-2); }
    .spacer { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentWizardPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(MessageService);
  private readonly workspaces = inject(WorkspaceStore);

  protected readonly steps = ['info', 'tables', 'review'] as const;
  protected readonly step = signal(0);
  protected readonly info = signal<TournamentFormValue>(emptyTournamentForm());
  protected readonly tables = signal<TableDraft[]>([draft({ name: '' }, true)]);
  protected readonly host = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly issues = signal<TableIssue[]>([]);

  protected readonly hosts = resource({ loader: () => this.api.hostOptions() });
  private readonly classifications = resource({ loader: () => this.api.classifications() });
  protected readonly scale = computed<Classification[]>(() => this.classifications.value() ?? []);

  protected readonly hostOptions = computed(() => {
    const options = this.hosts.value();
    if (!options) return [];
    return [
      ...(options.independent ? [{ label: this.t('tournaments.form.independentOption'), value: INDEPENDENT }] : []),
      ...options.organizations.map((o) => ({ label: `${o.name} · ${this.t('organizationType.' + o.type)}`, value: o.id })),
    ];
  });
  protected readonly hostLabel = computed(() => this.hostOptions().find((o) => o.value === this.host())?.label ?? '—');

  protected readonly stepValid = computed(() => {
    if (this.step() === 0) return !!this.host() && tournamentFormErrors(this.info()).length === 0;
    if (this.step() === 1) return this.tables().length > 0 && this.tables().every((d) => d.value.name.trim().length >= 2);
    return true;
  });

  constructor() {
    // Default host: the organization of the current workspace, else the first option.
    effect(() => {
      const options = this.hostOptions();
      if (this.host() || !options.length) return;
      const workspaceOrg = this.workspaces.organization()?.id;
      this.host.set(options.find((o) => o.value === workspaceOrg)?.value ?? options[0].value);
    });
  }

  protected targetsFor(index: number): TableOption[] {
    return this.tables()
      .slice(index + 1)
      .map((d, i) => ({ value: d.key, label: d.value.name || `${this.t('tournaments.eventForm.titleNew')} ${index + i + 2}` }));
  }

  protected targetName(key: string | null) {
    return this.tables().find((d) => d.key === key)?.value.name ?? null;
  }

  protected tableName(eventKeyOrId: string) {
    return this.targetName(eventKeyOrId) ?? '';
  }

  protected toggle(index: number) {
    this.tables.update((all) => all.map((d, i) => (i === index ? { ...d, open: !d.open } : d)));
  }

  protected setTable(index: number, value: EventInput) {
    this.tables.update((all) => all.map((d, i) => (i === index ? { ...d, value } : d)));
  }

  protected addTable() {
    this.tables.update((all) => [...all.map((d) => ({ ...d, open: false })), draft({}, true)]);
  }

  protected removeTable(index: number) {
    this.tables.update((all) => {
      const removed = all[index].key;
      return all
        .filter((_, i) => i !== index)
        .map((d) =>
          d.value.qualifiesIntoEventId === removed ? { ...d, value: { ...d.value, qualifiesIntoEventId: null, qualifierCount: 0 } } : d,
        );
    });
  }

  protected preset(kind: 'simple' | 'successive' | 'ladies') {
    const id = (code: string) => this.scale().find((c) => c.code === code)?.id ?? null;
    if (kind === 'ladies') {
      this.tables.update((all) => [...all, draft({ name: this.t('tournaments.wizard.names.ladies'), gender: 'WOMEN', maxEntries: 16 })]);
      return;
    }
    if (kind === 'simple') {
      this.tables.set([draft({ name: this.t('tournaments.wizard.names.singles'), maxEntries: 32 }, true)]);
      return;
    }
    const final = draft({ name: this.t('tournaments.wizard.names.final'), gender: 'MEN', minClassificationId: id('15'), maxEntries: 8, seedCount: 2 });
    const fifteen = draft({ name: this.t('tournaments.wizard.names.fifteen'), gender: 'MEN', minClassificationId: id('15/5'), maxClassificationId: id('15/1'), maxEntries: 16 });
    const thirty = draft({ name: this.t('tournaments.wizard.names.thirty'), gender: 'MEN', minClassificationId: id('30/5'), maxClassificationId: id('30'), maxEntries: 32 });
    thirty.value = { ...thirty.value, qualifiesIntoEventId: fifteen.key, qualifierCount: 2 };
    fifteen.value = { ...fifteen.value, qualifiesIntoEventId: final.key, qualifierCount: 2 };
    this.tables.set([thirty, fifteen, final]);
  }

  protected async create() {
    const host = this.host();
    this.saving.set(true);
    this.error.set(null);
    this.issues.set([]);
    try {
      const created = await this.api.create({
        ...toTournamentInput(this.info()),
        name: this.info().name.trim(),
        startDate: toTournamentInput(this.info()).startDate!,
        endDate: toTournamentInput(this.info()).endDate!,
        hostOrganizationId: host === INDEPENDENT ? null : host,
        events: this.tables().map(({ key, value }, index) => {
          const { qualifiesIntoEventId, ...rest } = value;
          return { ...rest, name: rest.name.trim(), tableOrder: index, ref: key, qualifiesIntoRef: qualifiesIntoEventId ?? undefined };
        }),
      });
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.wizard.created') });
      void this.router.navigate(['/tournaments', created.id]);
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error.set(describeError(error, this.t));
      if (error.code === 'TABLES_INVALID') this.issues.set(error.issues as TableIssue[]);
    } finally {
      this.saving.set(false);
    }
  }
}
