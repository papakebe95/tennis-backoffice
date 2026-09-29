import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectListQuery } from '../../shared/data/list-query';
import { TbDatePipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { ConfirmService } from '../../shared/ui/confirm';
import { StatusBadge } from '../../shared/ui/status-badge';
import { Bracket, type PlaceRequest } from './bracket';
import { SlotDrawer } from './slot-drawer';
import { TournamentApi } from './tournament.api';
import type { DrawView, TournamentDetail } from './tournament.models';
import type { TournamentCan } from './tournament-detail.page';

const SIZES = [2, 4, 8, 16, 32, 64, 128];
const nextPow2 = (n: number) => SIZES.find((s) => s >= n) ?? null;

/** The "Draw" tab: make, adjust, publish and lock each table's draw. */
@Component({
  selector: 'tb-draw-panel',
  imports: [FormsModule, ButtonModule, DialogModule, InputNumberModule, MessageModule, SelectModule, SkeletonModule, EmptyState, StatusBadge, TbDatePipe, Bracket, SlotDrawer],
  template: `
    @let d = tournament();
    @if (!d.events.length) {
      <div class="tb-card"><tb-empty-state [message]="t('tournaments.registrations.noEvents')" icon="pi pi-sitemap" /></div>
    } @else {
      <section class="tb-card head">
        <p-select [options]="eventOptions()" [ngModel]="eventId()" (ngModelChange)="list.update({ event: $event })" [attr.aria-label]="t('tournaments.draw.event')" styleClass="event-select" />
        @if (view(); as v) {
          <tb-status-badge kind="draw" [value]="v.event.drawStatus" />
          @if (v.event.drawSize && v.event.drawGeneratedAt) {
            <span class="tb-muted meta">{{ t('tournaments.draw.meta', { size: v.event.drawSize, date: (v.event.drawGeneratedAt | tbDate: 'date') }) }}</span>
          }
          <span class="spacer"></span>
          @if (can()('draw.manage') && beforePlay()) {
            @if (v.event.drawStatus === 'NOT_GENERATED' || v.event.drawStatus === 'DRAFT') {
              <p-button [label]="v.event.drawStatus === 'DRAFT' ? t('tournaments.draw.regenerate') : t('tournaments.draw.generate')" icon="pi pi-sync" [outlined]="v.event.drawStatus === 'DRAFT'" [disabled]="!supported()" (onClick)="openGenerate(v)" />
            }
            @if (v.event.drawStatus === 'DRAFT' || v.event.drawStatus === 'PUBLISHED') {
              <p-button [label]="t('tournaments.draw.reset')" icon="pi pi-undo" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="act('reset')" />
            }
          }
          @if (can()('draw.publish')) {
            @if (v.event.drawStatus === 'DRAFT') {
              <p-button [label]="t('tournaments.draw.publish')" icon="pi pi-send" [disabled]="busy()" (onClick)="act('publish')" />
            }
            @if (v.event.drawStatus === 'PUBLISHED') {
              <p-button [label]="t('tournaments.draw.lock')" icon="pi pi-lock" severity="secondary" [outlined]="true" [disabled]="busy()" (onClick)="act('lock')" />
            }
          }
        }
      </section>

      @if (draw.error() && !view()) {
        <div class="tb-card"><tb-empty-state [message]="t('list.loadError')" icon="pi pi-exclamation-triangle" /></div>
      } @else if (view(); as v) {
        @if (!supported()) {
          <p-message severity="info" class="msg">{{ t('tournaments.draw.unsupported') }}</p-message>
        }
        @if (v.event.drawStatus === 'NOT_GENERATED') {
          <div class="tb-card empty">
            <i class="pi pi-sitemap" aria-hidden="true"></i>
            <p>{{ t('tournaments.draw.notGenerated') }}</p>
            <p class="tb-muted">
              {{ v.suggestion.size ? t('tournaments.draw.suggestion', { entries: v.suggestion.entries, places: v.suggestion.qualifierPlaces, size: v.suggestion.size }) : t('tournaments.draw.suggestionTooFew') }}
            </p>
          </div>
        } @else {
          <p class="hint tb-muted">
            <i class="pi pi-info-circle" aria-hidden="true"></i>
            {{ t(v.event.drawStatus === 'LOCKED' ? 'tournaments.draw.lockedHint' : v.event.drawStatus === 'PUBLISHED' ? 'tournaments.draw.publishedHint' : 'tournaments.draw.draftHint') }}
            @if (v.unplacedCount) {
              · <strong>{{ t('tournaments.draw.unplaced', { count: v.unplacedCount }) }}</strong>
            }
          </p>
          <tb-bracket [view]="v" [swappable]="swappable()" [canPlace]="canPlace()" (swap)="swap($event)" (place)="placing.set($event)" />
          @if (v.event.drawSeed) {
            <p class="seed-key tb-muted" [title]="t('tournaments.draw.seedKeyHint')">{{ t('tournaments.draw.seedKey') }} : <code>{{ v.event.drawSeed }}</code></p>
          }
        }
      } @else {
        <p-skeleton height="360px" borderRadius="14px" />
      }

      <p-dialog [(visible)]="generateOpen" [modal]="true" [header]="t('tournaments.draw.generateDialog.title')" [style]="{ width: 'min(520px, 94vw)' }" [draggable]="false">
        @if (generateError()) {
          <p-message severity="error" class="msg">{{ generateError() }}</p-message>
        }
        @if (view()?.event?.drawStatus === 'DRAFT') {
          <p-message severity="warn" class="msg">{{ t('tournaments.draw.generateDialog.redraw') }}</p-message>
        }
        <div class="two">
          <div class="tb-field">
            <label for="gd-seeds">{{ t('tournaments.draw.generateDialog.seedCount') }}</label>
            <p-inputnumber inputId="gd-seeds" [ngModel]="form().seedCount" (ngModelChange)="patch('seedCount', $event ?? 0)" [min]="0" [max]="32" [showButtons]="true" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="gd-size">{{ t('tournaments.draw.generateDialog.size') }}</label>
            <p-select inputId="gd-size" [options]="sizeOptions()" [ngModel]="form().size" (ngModelChange)="patch('size', $event)" appendTo="body" [fluid]="true" />
          </div>
        </div>
        <span class="tb-field-hint">{{ t('tournaments.draw.generateDialog.seedCountHint') }}</span>
        <div class="two">
          <div class="tb-field">
            <label for="gd-q">{{ t('tournaments.draw.generateDialog.qualifierPlaces') }}</label>
            <p-inputnumber inputId="gd-q" [ngModel]="form().qualifierPlaces" (ngModelChange)="patch('qualifierPlaces', $event ?? 0)" [min]="0" [max]="64" [showButtons]="true" [fluid]="true" />
            <span class="tb-field-hint">{{ t('tournaments.draw.generateDialog.qualifierHint') }}</span>
          </div>
          <div class="tb-field">
            <label for="gd-empty">{{ t('tournaments.draw.generateDialog.emptyPlaces') }}</label>
            <p-inputnumber inputId="gd-empty" [ngModel]="form().emptyPlaces" (ngModelChange)="patch('emptyPlaces', $event ?? 0)" [min]="0" [max]="64" [showButtons]="true" [fluid]="true" />
            <span class="tb-field-hint">{{ t('tournaments.draw.generateDialog.emptyHint') }}</span>
          </div>
        </div>
        @if (preview(); as p) {
          <p class="preview"><i class="pi pi-sitemap" aria-hidden="true"></i> {{ t('tournaments.draw.suggestion', { entries: p.entries, places: p.places, size: p.size }) }} · {{ t('tournaments.draw.generateDialog.byes', { count: p.byes }) }}</p>
        }
        <ng-template #footer>
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="generateOpen.set(false)" />
          <p-button [label]="t('tournaments.draw.generateDialog.submit')" icon="pi pi-sync" [loading]="busy()" [disabled]="!preview()" (onClick)="generate()" />
        </ng-template>
      </p-dialog>

      @if (view(); as v) {
        <tb-slot-drawer [view]="v" [request]="placing()" (closed)="placing.set(null)" (done)="applied($event)" />
      }
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-3); padding: var(--tb-space-3) var(--tb-space-4); }
    :host ::ng-deep .event-select { min-width: 260px; font-weight: var(--tb-weight-semibold); }
    .meta { font-size: var(--tb-text-sm); }
    .spacer { flex: 1; }
    .msg { display: block; margin-bottom: var(--tb-space-3); }
    .empty { display: grid; justify-items: center; gap: var(--tb-space-2); padding: var(--tb-space-10) var(--tb-space-6); text-align: center; }
    .empty i { font-size: 2rem; color: var(--tb-primary-500); }
    .empty p { margin: 0; }
    .hint { margin: 0; font-size: var(--tb-text-sm); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .seed-key { margin: 0; font-size: var(--tb-text-xs); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--tb-space-3); }
    .preview { margin: var(--tb-space-4) 0 0; padding: var(--tb-space-3); border-radius: var(--tb-radius-md); background: var(--tb-primary-50); color: var(--tb-primary-800); font-size: var(--tb-text-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawPanel {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(MessageService);

  readonly tournament = input.required<TournamentDetail>();
  readonly can = input.required<TournamentCan>();
  readonly changed = output<void>();

  protected readonly list = injectListQuery(['event']);
  protected readonly eventId = computed(() => {
    const events = this.tournament().events;
    const wanted = this.list.query().filters['event'];
    return events.find((e) => e.id === wanted)?.id ?? events[0]?.id ?? null;
  });
  protected readonly eventOptions = computed(() => this.tournament().events.map((e) => ({ label: e.name, value: e.id })));
  protected readonly draw = resource({ params: () => this.eventId() ?? undefined, loader: ({ params }) => this.api.draw(params) });
  /** Keeps the last draw on screen while the next one loads. */
  protected readonly view = linkedSignal<DrawView | undefined, DrawView | undefined>({
    source: () => this.draw.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly busy = signal(false);
  protected readonly placing = signal<PlaceRequest | null>(null);
  protected readonly beforePlay = computed(() => ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(this.tournament().status));
  protected readonly supported = computed(() => this.view()?.event.format !== 'ROUND_ROBIN');
  protected readonly swappable = computed(() => {
    const status = this.view()?.event.drawStatus;
    return this.can()('draw.manage') && this.beforePlay() && (status === 'DRAFT' || status === 'PUBLISHED');
  });
  protected readonly canPlace = computed(() => {
    const status = this.view()?.event.drawStatus;
    if (!status || status === 'NOT_GENERATED' || !this.can()('draw.manage')) return false;
    if (['COMPLETED', 'CANCELLED'].includes(this.tournament().status)) return false;
    return status !== 'LOCKED' || this.can()('draw.modify_locked');
  });

  // Generating ---------------------------------------------------------------

  protected readonly generateOpen = signal(false);
  protected readonly generateError = signal<string | null>(null);
  protected readonly form = signal({ seedCount: 0, qualifierPlaces: 0, emptyPlaces: 0, size: null as number | null });
  protected readonly preview = computed(() => {
    const v = this.view();
    if (!v) return null;
    const f = this.form();
    const lines = v.suggestion.entries + f.qualifierPlaces + f.emptyPlaces;
    const auto = lines >= 2 ? nextPow2(lines) : null;
    const size = f.size && auto && f.size >= auto ? f.size : auto;
    return size ? { entries: v.suggestion.entries, places: f.qualifierPlaces + f.emptyPlaces, size, byes: size - lines } : null;
  });
  protected readonly sizeOptions = computed(() => {
    const v = this.view();
    const f = this.form();
    const lines = (v?.suggestion.entries ?? 0) + f.qualifierPlaces + f.emptyPlaces;
    const auto = nextPow2(Math.max(2, lines)) ?? 128;
    return [
      { label: this.t('tournaments.draw.generateDialog.sizeAuto', { size: auto }), value: null },
      ...SIZES.filter((s) => s > auto).map((s) => ({ label: String(s), value: s })),
    ];
  });

  protected patch(key: 'seedCount' | 'qualifierPlaces' | 'emptyPlaces' | 'size', value: number | null) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected openGenerate(v: DrawView) {
    this.form.set({ seedCount: v.suggestion.seedCount, qualifierPlaces: v.suggestion.qualifierPlaces, emptyPlaces: 0, size: null });
    this.generateError.set(null);
    this.generateOpen.set(true);
  }

  protected async generate() {
    const id = this.eventId();
    if (!id) return;
    const f = this.form();
    this.busy.set(true);
    this.generateError.set(null);
    try {
      this.draw.set(await this.api.generateDraw(id, { seedCount: f.seedCount, qualifierPlaces: f.qualifierPlaces, emptyPlaces: f.emptyPlaces, size: f.size ?? undefined }));
      this.generateOpen.set(false);
      this.toasts.add({ severity: 'success', summary: this.t('tournaments.draw.done') });
      this.changed.emit();
    } catch (raw) {
      this.generateError.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.busy.set(false);
    }
  }

  // Status actions -----------------------------------------------------------

  protected async act(action: 'reset' | 'publish' | 'lock') {
    const id = this.eventId();
    if (!id) return;
    const answer = await this.confirm.ask({
      title: this.t(`tournaments.draw.${action}Title`),
      message: this.tournament().events.find((e) => e.id === id)?.name,
      detail: this.t(`tournaments.draw.${action}Message`),
      confirmLabel: this.t(`tournaments.draw.${action}`),
      severity: action === 'reset' ? 'danger' : 'primary',
    });
    if (!answer) return;
    await this.run(() => this.api.drawAction(id, action), 'tournaments.draw.done');
  }

  protected async swap({ a, b }: { a: number; b: number }) {
    const v = this.view();
    if (!v) return;
    if (v.event.drawStatus === 'PUBLISHED') {
      const answer = await this.confirm.ask({
        title: this.t('tournaments.draw.swapTitle'),
        message: this.t('tournaments.draw.swapMessage'),
        confirmLabel: this.t('common.confirm'),
      });
      if (!answer) return;
    }
    await this.run(() => this.api.swapSlots(v.event.id, a, b, v.event.drawVersion), 'tournaments.draw.swapped');
  }

  protected applied(view: DrawView) {
    this.draw.set(view);
    this.placing.set(null);
    this.changed.emit();
  }

  private async run(action: () => Promise<DrawView>, success: string) {
    this.busy.set(true);
    try {
      this.draw.set(await action());
      this.toasts.add({ severity: 'success', summary: this.t(success) });
      this.changed.emit();
    } catch (raw) {
      const error = ApiError.from(raw);
      this.toasts.add({ severity: 'error', summary: describeError(error, this.t) });
      // Someone else changed the draw: show the current one.
      if (error.code === 'DRAW_VERSION_CONFLICT') this.draw.reload();
    } finally {
      this.busy.set(false);
    }
  }
}
