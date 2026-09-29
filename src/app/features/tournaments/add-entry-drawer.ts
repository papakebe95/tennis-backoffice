import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { UserCell } from '../../shared/ui/bits';
import { SearchInput } from '../../shared/ui/search-input';
import { TournamentApi } from './tournament.api';
import { ENTRY_TYPES, type EligibilityIssue, type EntryCandidate, type EntryType, type RegistrationStatus, type TournamentDetail } from './tournament.models';

/**
 * Enter a player (or a pair) in a table from the back-office: direct entry,
 * qualifier from a lower table, wildcard… Ineligible players need a reason,
 * kept in the audit log.
 */
@Component({
  selector: 'tb-add-entry-drawer',
  imports: [FormsModule, ButtonModule, DrawerModule, MessageModule, SelectModule, TextareaModule, UserCell, SearchInput],
  template: `
    <p-drawer [(visible)]="visible" position="right" styleClass="tb-drawer tb-drawer-lg" [header]="t('tournaments.addEntry.title') + ' · ' + (event()?.name ?? '')" (onHide)="reset()">
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }

      @for (slot of slots(); track slot) {
        <div class="tb-field">
          <label>{{ t(slot === 'player' ? 'tournaments.addEntry.search' : 'tournaments.addEntry.searchPartner') }}</label>
          @if (picked()[slot]; as p) {
            <div class="picked">
              <tb-user-cell [firstname]="p.firstname" [lastname]="p.lastname" [secondary]="p.phone + ' · ' + (p.classification?.code ?? 'NC')" />
              @if (p.issues.length) {
                <span class="issues">
                  @for (issue of p.issues; track issue) {
                    <span class="issue">{{ t('tournaments.issues.' + issue) }}</span>
                  }
                </span>
              }
              <p-button [label]="t('tournaments.addEntry.change')" [text]="true" size="small" severity="secondary" (onClick)="pick(slot, null)" />
            </div>
          } @else {
            <tb-search-input [value]="query()[slot]" [placeholder]="t('tournaments.addEntry.searchHint')" (search)="search(slot, $event)" />
            @if (searching() === slot) {
              <ul class="candidates">
                @for (c of candidates.value() ?? []; track c.id) {
                  <li>
                    <button type="button" [disabled]="c.alreadyEntered || isPicked(c.id)" (click)="pick(slot, c)">
                      <tb-user-cell [firstname]="c.firstname" [lastname]="c.lastname" [secondary]="c.phone + ' · ' + (c.classification?.code ?? 'NC')" />
                      @if (c.alreadyEntered) {
                        <small>{{ t('tournaments.addEntry.alreadyEntered') }}</small>
                      } @else if (c.issues.length) {
                        <small class="warn"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i> {{ issueText(c.issues) }}</small>
                      } @else {
                        <i class="pi pi-chevron-right" aria-hidden="true"></i>
                      }
                    </button>
                  </li>
                } @empty {
                  @if (query()[slot].length >= 2 && !candidates.isLoading()) {
                    <li class="tb-muted">{{ t('tournaments.addEntry.noResult') }}</li>
                  }
                }
              </ul>
            }
          }
        </div>
      }

      <div class="two">
        <div class="tb-field">
          <label for="ae-type">{{ t('tournaments.addEntry.entryType') }}</label>
          <p-select inputId="ae-type" [options]="entryTypeOptions()" [ngModel]="entryType()" (ngModelChange)="entryType.set($event)" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label for="ae-status">{{ t('tournaments.addEntry.status') }}</label>
          <p-select inputId="ae-status" [options]="statusOptions()" [ngModel]="status()" (ngModelChange)="status.set($event)" appendTo="body" [fluid]="true" />
        </div>
      </div>
      @if (needsSource()) {
        <div class="tb-field">
          <label for="ae-source">{{ t('tournaments.addEntry.source') }}</label>
          <p-select inputId="ae-source" [options]="sourceOptions()" [ngModel]="sourceEventId()" (ngModelChange)="sourceEventId.set($event)" [placeholder]="t('tournaments.addEntry.sourceNone')" appendTo="body" [fluid]="true" />
        </div>
      }
      @if (overrideNeeded()) {
        <div class="tb-field">
          <label for="ae-override">{{ t('tournaments.addEntry.override') }}</label>
          <textarea pTextarea id="ae-override" rows="2" [autoResize]="true" [ngModel]="overrideReason()" (ngModelChange)="overrideReason.set($event)" maxlength="300"></textarea>
          <span class="tb-field-hint">{{ t('tournaments.addEntry.overrideHint') }}</span>
        </div>
      }

      <ng-template #footer>
        <div class="footer">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
          <p-button [label]="t('tournaments.addEntry.submit')" icon="pi pi-check" [loading]="saving()" [disabled]="!valid()" (onClick)="submit()" />
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: `
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tb-space-3); }
    textarea { width: 100%; }
    .picked { display: flex; align-items: center; gap: var(--tb-space-3); flex-wrap: wrap; padding: var(--tb-space-2) var(--tb-space-3); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); }
    .picked tb-user-cell { flex: 1 1 auto; min-width: 0; }
    .picked .issues { order: 3; flex-basis: 100%; }
    .candidates { list-style: none; margin: var(--tb-space-2) 0 0; padding: 0; display: grid; gap: 2px; }
    .candidates button { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--tb-space-3); padding: var(--tb-space-2) var(--tb-space-3); border-radius: var(--tb-radius-md); cursor: pointer; }
    .candidates button:hover:not(:disabled), .candidates button:focus-visible { background: var(--tb-surface-muted); }
    .candidates button:disabled { opacity: 0.55; cursor: default; }
    .candidates small { color: var(--tb-text-muted); text-align: right; }
    .candidates small.warn { color: var(--tb-tone-warning-fg); }
    .issues { display: flex; flex-wrap: wrap; gap: 4px; }
    .issue { font-size: var(--tb-text-xs); padding: 1px 8px; border-radius: var(--tb-radius-full); background: var(--tb-tone-danger-bg); color: var(--tb-tone-danger-fg); }
    .footer { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddEntryDrawer {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly toasts = inject(MessageService);

  readonly tournament = input.required<TournamentDetail>();
  readonly eventId = input.required<string>();
  readonly visible = model(false);
  readonly added = output<void>();

  protected readonly event = computed(() => this.tournament().events.find((e) => e.id === this.eventId()) ?? null);
  protected readonly slots = computed(() => (this.event()?.discipline === 'DOUBLES' ? (['player', 'partner'] as const) : (['player'] as const)));

  protected readonly query = signal({ player: '', partner: '' });
  protected readonly searching = signal<'player' | 'partner' | null>(null);
  protected readonly picked = signal<{ player: EntryCandidate | null; partner: EntryCandidate | null }>({ player: null, partner: null });
  protected readonly entryType = signal<EntryType>('DIRECT');
  protected readonly status = signal<RegistrationStatus>('APPROVED');
  protected readonly sourceEventId = signal<string | null>(null);
  protected readonly overrideReason = signal('');
  protected readonly serverIssues = signal<EligibilityIssue[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly candidates = resource({
    params: () => {
      const slot = this.searching();
      const q = slot ? this.query()[slot] : '';
      return this.visible() && q.length >= 2 ? { eventId: this.eventId(), q } : undefined;
    },
    loader: ({ params }) => this.api.entryCandidates(params.eventId, params.q),
  });
  private readonly sources = resource({
    params: () => (this.visible() ? this.eventId() : undefined),
    loader: ({ params }) => this.api.qualifierSources(params),
  });

  protected readonly entryTypeOptions = computed(() => ENTRY_TYPES.map((v) => ({ label: this.t(`tournaments.entryTypes.${v}`), value: v })));
  protected readonly statusOptions = computed(() =>
    (['APPROVED', 'PENDING', 'WAITLISTED'] as const).map((v) => ({ label: this.t(`tournaments.addEntry.statuses.${v}`), value: v })),
  );
  protected readonly sourceOptions = computed(() => (this.sources.value() ?? []).map((s) => ({ label: s.name, value: s.id })));
  protected readonly needsSource = computed(() => this.entryType() === 'QUALIFIER' || this.entryType() === 'LUCKY_LOSER');

  /**
   * An accepted entry with eligibility issues needs a reason. Candidates are
   * checked as direct entries; qualifiers and wildcards may be below the
   * table's floor, so "too weak" doesn't count for them (the API decides).
   */
  protected readonly overrideNeeded = computed(() => {
    if (this.status() !== 'APPROVED') return false;
    if (this.serverIssues().length) return true;
    const exempt = this.entryType() === 'QUALIFIER' || this.entryType() === 'LUCKY_LOSER' || this.entryType() === 'WILDCARD';
    const players = [this.picked().player, this.picked().partner].filter((p): p is EntryCandidate => !!p);
    return players.some((p) => p.issues.some((i) => !(exempt && i === 'CLASSIFICATION_TOO_WEAK')));
  });

  protected readonly valid = computed(() => {
    const { player, partner } = this.picked();
    if (!player || (this.slots().length === 2 && !partner)) return false;
    if (this.needsSource() && !this.sourceEventId()) return false;
    if (this.overrideNeeded() && !this.overrideReason().trim()) return false;
    return !this.saving();
  });

  protected issueText(issues: EligibilityIssue[]) {
    return issues.map((i) => this.t(`tournaments.issues.${i}`)).join(', ');
  }

  protected isPicked(id: string) {
    const { player, partner } = this.picked();
    return player?.id === id || partner?.id === id;
  }

  protected search(slot: 'player' | 'partner', q: string) {
    this.query.update((v) => ({ ...v, [slot]: q }));
    this.searching.set(slot);
  }

  protected pick(slot: 'player' | 'partner', candidate: EntryCandidate | null) {
    this.picked.update((v) => ({ ...v, [slot]: candidate }));
    this.serverIssues.set([]);
    if (!candidate) this.searching.set(slot);
  }

  protected reset() {
    this.query.set({ player: '', partner: '' });
    this.searching.set(null);
    this.picked.set({ player: null, partner: null });
    this.entryType.set('DIRECT');
    this.status.set('APPROVED');
    this.sourceEventId.set(null);
    this.overrideReason.set('');
    this.serverIssues.set([]);
    this.error.set(null);
  }

  protected async submit() {
    const { player, partner } = this.picked();
    if (!player) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.addEntry(this.eventId(), {
        userId: player.id,
        partnerUserId: partner?.id ?? null,
        entryType: this.entryType(),
        sourceEventId: this.needsSource() ? this.sourceEventId() : null,
        status: this.status(),
        overrideReason: this.overrideReason().trim() || undefined,
      });
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.addEntry.added') });
      this.visible.set(false);
      this.added.emit();
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.code === 'NOT_ELIGIBLE') this.serverIssues.set(error.issues as EligibilityIssue[]);
      this.error.set(
        error.code === 'NOT_ELIGIBLE'
          ? `${describeError(error, this.t)} ${this.issueText(error.issues as EligibilityIssue[])}`
          : describeError(error, this.t),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
