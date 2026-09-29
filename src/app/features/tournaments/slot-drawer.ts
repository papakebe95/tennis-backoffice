import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { UserCell } from '../../shared/ui/bits';
import { SearchInput } from '../../shared/ui/search-input';
import type { PlaceRequest } from './bracket';
import { TournamentApi } from './tournament.api';
import { ENTRY_TYPES, type DrawView, type EligibilityIssue, type EntryType } from './tournament.models';

interface Choice {
  participantId?: string;
  userId?: string;
  name: string;
  sourceEventId?: string;
  defaultType: EntryType;
}

/**
 * Fills a reserved draw place or replaces a player: pick an accepted entry
 * outside the draw, a player of a lower table (best finishers first) or any
 * other player.
 */
@Component({
  selector: 'tb-slot-drawer',
  imports: [FormsModule, ButtonModule, DrawerModule, MessageModule, SelectModule, TextareaModule, UserCell, SearchInput],
  template: `
    <p-drawer [visible]="!!request()" (visibleChange)="!$event && closed.emit()" position="right" styleClass="tb-drawer tb-drawer-lg" [header]="title()">
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }
      @if (beyondRules()) {
        <p-message severity="warn" class="msg">{{ t('tournaments.draw.slot.beyondRules') }}</p-message>
      }

      @if (choice(); as c) {
        <div class="picked">
          <span class="tb-muted small">{{ t('tournaments.draw.slot.picked') }}</span>
          <strong>{{ c.name }}</strong>
          <p-button [label]="t('tournaments.addEntry.change')" [text]="true" size="small" severity="secondary" (onClick)="choose(null)" />
        </div>
        @if (!c.participantId) {
          <div class="tb-field">
            <label for="sd-type">{{ t('tournaments.draw.slot.entryType') }}</label>
            <p-select inputId="sd-type" [options]="entryTypes()" [ngModel]="entryType()" (ngModelChange)="entryType.set($event)" appendTo="body" [fluid]="true" />
          </div>
        }
        <div class="tb-field">
          <label for="sd-reason">{{ t('tournaments.draw.slot.reason') }}</label>
          <textarea pTextarea id="sd-reason" rows="2" [autoResize]="true" [ngModel]="reason()" (ngModelChange)="reason.set($event)" maxlength="300"></textarea>
          <span class="tb-field-hint">{{ t('tournaments.draw.slot.reasonHint') }}</span>
        </div>
        @if (issues().length) {
          <div class="tb-field">
            <label for="sd-override">{{ t('tournaments.draw.slot.override') }}</label>
            <textarea pTextarea id="sd-override" rows="2" [autoResize]="true" [ngModel]="overrideReason()" (ngModelChange)="overrideReason.set($event)" maxlength="300"></textarea>
            <span class="tb-field-hint">{{ t('tournaments.draw.slot.overrideHint', { issues: issueText() }) }}</span>
          </div>
        }
      } @else {
        <section>
          <h3>{{ t('tournaments.draw.slot.unplaced') }}</h3>
          <ul class="list">
            @for (e of candidates.value()?.unplaced ?? []; track e.id) {
              <li>
                <!-- An accepted entry is placed as is; a pending one is accepted on the way (eligibility checked). -->
                <button type="button" (click)="choose(e.status === 'APPROVED' ? { participantId: e.id, name: e.player.firstname + ' ' + e.player.lastname, defaultType: e.entryType } : { userId: e.player.id, name: e.player.firstname + ' ' + e.player.lastname, defaultType: e.entryType })">
                  <tb-user-cell [firstname]="e.player.firstname" [lastname]="e.player.lastname" [secondary]="(e.player.classification ?? 'NC') + ' · ' + t('tournaments.entryTypes.' + e.entryType)" />
                  <small>{{ t('status.registration.' + e.status) }}</small>
                </button>
              </li>
            } @empty {
              <li class="tb-muted small">{{ t('tournaments.draw.slot.noneUnplaced') }}</li>
            }
          </ul>
        </section>

        @for (table of candidates.value()?.lowerTables ?? []; track table.event.id) {
          <section>
            <h3>{{ t('tournaments.draw.slot.lower', { name: table.event.name }) }}</h3>
            <ul class="list">
              @for (p of table.players; track p.id) {
                <li>
                  <button type="button" [disabled]="p.alreadyInEvent" (click)="choose({ userId: p.player.id, name: p.player.firstname + ' ' + p.player.lastname, sourceEventId: table.event.id, defaultType: 'QUALIFIER' })">
                    <tb-user-cell [firstname]="p.player.firstname" [lastname]="p.player.lastname" [secondary]="(p.player.classification ?? 'NC')" />
                    <small [class.champion]="p.champion">
                      {{ p.alreadyInEvent ? t('tournaments.draw.slot.alreadyInEvent') : p.champion ? t('tournaments.draw.slot.champion') : p.roundReached ? t('tournaments.draw.slot.reached', { round: p.roundReached }) : t('tournaments.draw.slot.notPlayed') }}
                    </small>
                  </button>
                </li>
              }
            </ul>
          </section>
        }

        <section>
          <h3>{{ t('tournaments.draw.slot.other') }}</h3>
          <tb-search-input [value]="query()" [placeholder]="t('tournaments.addEntry.searchHint')" (search)="query.set($event)" />
          <ul class="list">
            @for (c of others.value() ?? []; track c.id) {
              <li>
                <button type="button" [disabled]="c.alreadyEntered" (click)="choose({ userId: c.id, name: c.firstname + ' ' + c.lastname, defaultType: request()?.mode === 'fill' ? 'DIRECT' : 'ALTERNATE' })">
                  <tb-user-cell [firstname]="c.firstname" [lastname]="c.lastname" [secondary]="c.phone + ' · ' + (c.classification?.code ?? 'NC')" />
                  <small>{{ c.alreadyEntered ? t('tournaments.addEntry.alreadyEntered') : '' }}</small>
                </button>
              </li>
            }
          </ul>
        </section>
      }

      <ng-template #footer>
        <div class="footer">
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="closed.emit()" />
          <p-button
            [label]="request()?.mode === 'replace' ? t('tournaments.draw.slot.submitReplace') : t('tournaments.draw.slot.submitFill')"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="!valid()"
            (onClick)="submit()"
          />
        </div>
      </ng-template>
    </p-drawer>
  `,
  styles: `
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    section { margin-bottom: var(--tb-space-5); }
    h3 { font-size: var(--tb-text-sm); text-transform: uppercase; letter-spacing: 0.04em; color: var(--tb-text-muted); margin: 0 0 var(--tb-space-2); }
    .list { list-style: none; margin: var(--tb-space-2) 0 0; padding: 0; display: grid; gap: 2px; }
    .list button { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--tb-space-3); padding: var(--tb-space-2) var(--tb-space-3); border-radius: var(--tb-radius-md); cursor: pointer; }
    .list button:hover:not(:disabled), .list button:focus-visible { background: var(--tb-surface-muted); }
    .list button:disabled { opacity: 0.5; cursor: default; }
    .list small { color: var(--tb-text-muted); white-space: nowrap; }
    .list small.champion { color: var(--tb-tone-success-fg); font-weight: var(--tb-weight-semibold); }
    .small { font-size: var(--tb-text-sm); }
    .picked { display: flex; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3); border: 1px solid var(--tb-primary-200); background: var(--tb-primary-50); border-radius: var(--tb-radius-md); margin-bottom: var(--tb-space-4); }
    .picked strong { flex: 1; }
    textarea { width: 100%; }
    .footer { display: flex; justify-content: flex-end; gap: var(--tb-space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlotDrawer {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly toasts = inject(MessageService);

  readonly view = input.required<DrawView>();
  readonly request = input<PlaceRequest | null>(null);
  readonly closed = output<void>();
  readonly done = output<DrawView>();

  protected readonly choice = signal<Choice | null>(null);
  protected readonly entryType = signal<EntryType>('DIRECT');
  protected readonly reason = signal('');
  protected readonly overrideReason = signal('');
  protected readonly issues = signal<EligibilityIssue[]>([]);
  protected readonly query = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly candidates = resource({
    params: () => (this.request() ? this.view().event.id : undefined),
    loader: ({ params }) => this.api.drawCandidates(params),
  });
  protected readonly others = resource({
    params: () => (this.request() && this.query().length >= 2 ? { id: this.view().event.id, q: this.query() } : undefined),
    loader: ({ params }) => this.api.entryCandidates(params.id, params.q),
  });

  private readonly slot = computed(() => this.view().slots.find((s) => s.position === this.request()?.position) ?? null);
  private readonly outgoing = computed(() => {
    const id = this.slot()?.participantId;
    return id ? this.view().entries[id] : null;
  });

  protected readonly title = computed(() => {
    const request = this.request();
    if (!request) return '';
    if (request.mode === 'fill') return this.t('tournaments.draw.slot.fillTitle', { label: this.slot()?.label ?? '' });
    const out = this.outgoing();
    return this.t('tournaments.draw.slot.replaceTitle', { name: out ? `${out.player.firstname} ${out.player.lastname}` : '' });
  });

  /** Replacing someone who already won a (played) match. */
  protected readonly beyondRules = computed(() => {
    const id = this.slot()?.participantId;
    if (this.request()?.mode !== 'replace' || !id) return false;
    return this.view().rounds.some((r) => r.matches.some((m) => m.status === 'COMPLETED' && m.winnerId === id));
  });

  protected readonly reasonRequired = computed(() => this.request()?.mode === 'replace' || this.view().event.drawStatus === 'LOCKED');
  protected readonly valid = computed(
    () =>
      !!this.choice() &&
      (!this.reasonRequired() || !!this.reason().trim()) &&
      (!this.issues().length || !!this.overrideReason().trim()) &&
      !this.saving(),
  );
  protected readonly entryTypes = computed(() => ENTRY_TYPES.map((v) => ({ label: this.t(`tournaments.entryTypes.${v}`), value: v })));
  protected readonly issueText = computed(() => this.issues().map((i) => this.t(`tournaments.issues.${i}`)).join(', '));

  constructor() {
    // A new request starts from scratch.
    effect(() => {
      this.request();
      this.choose(null);
      this.reason.set('');
      this.query.set('');
      this.error.set(null);
    });
  }

  protected choose(choice: Choice | null) {
    this.choice.set(choice);
    this.entryType.set(choice?.defaultType ?? 'DIRECT');
    this.issues.set([]);
    this.overrideReason.set('');
  }

  protected async submit() {
    const request = this.request();
    const choice = this.choice();
    if (!request || !choice) return;
    this.saving.set(true);
    this.error.set(null);
    const body = {
      participantId: choice.participantId,
      userId: choice.userId,
      entryType: choice.participantId ? undefined : this.entryType(),
      sourceEventId: choice.sourceEventId,
      reason: this.reason().trim() || undefined,
      overrideReason: this.overrideReason().trim() || undefined,
      version: this.view().event.drawVersion,
    };
    try {
      const view =
        request.mode === 'fill'
          ? await this.api.fillSlot(this.view().event.id, request.position, body)
          : await this.api.replaceInSlot(this.view().event.id, request.position, body);
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.draw.done') });
      this.done.emit(view);
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.code === 'NOT_ELIGIBLE') this.issues.set(error.issues as EligibilityIssue[]);
      this.error.set(describeError(error, this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
