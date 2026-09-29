import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TournamentApi } from './tournament.api';
import { INTERRUPTION_REASONS, type InterruptionReason, type TournamentDetail } from './tournament.models';

/** Stops play (rain, power cut…); the reason is kept and told to entrants. */
@Component({
  selector: 'tb-interrupt-dialog',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, SelectModule, ToggleSwitchModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [header]="t('tournaments.interruption.dialogTitle')" [style]="{ width: 'min(480px, 94vw)' }" [draggable]="false" (onShow)="reset()">
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }
      <div class="tb-field">
        <label for="int-reason">{{ t('tournaments.interruption.reason') }}</label>
        <p-select inputId="int-reason" [options]="reasons()" [ngModel]="reason()" (ngModelChange)="reason.set($event)" appendTo="body" [fluid]="true" />
      </div>
      <div class="tb-field">
        <label for="int-note">{{ t('tournaments.interruption.note') }}</label>
        <input pInputText id="int-note" [ngModel]="note()" (ngModelChange)="note.set($event)" maxlength="500" [placeholder]="t('tournaments.interruption.notePlaceholder')" />
      </div>
      <label class="switch">
        <p-toggleswitch inputId="int-notify" [ngModel]="notify()" (ngModelChange)="notify.set($event)" />
        <span>{{ t('tournaments.interruption.notify') }}</span>
      </label>
      <ng-template #footer>
        <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button [label]="t('tournaments.interruption.submit')" icon="pi pi-pause" severity="warn" [loading]="saving()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .msg { display: block; margin-bottom: var(--tb-space-4); }
    input { width: 100%; }
    .switch { display: inline-flex; align-items: center; gap: var(--tb-space-2); cursor: pointer; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterruptDialog {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);

  readonly tournamentId = input.required<string>();
  readonly visible = model(false);
  readonly done = output<TournamentDetail>();

  protected readonly reason = signal<InterruptionReason>('WEATHER');
  protected readonly note = signal('');
  protected readonly notify = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reasons = computed(() =>
    INTERRUPTION_REASONS.map((r) => ({ label: this.t(`tournaments.interruptionReasons.${r}`), value: r })),
  );

  protected reset() {
    this.reason.set('WEATHER');
    this.note.set('');
    this.notify.set(true);
    this.error.set(null);
  }

  protected async submit() {
    this.saving.set(true);
    this.error.set(null);
    try {
      const detail = await this.api.interrupt(this.tournamentId(), {
        reason: this.reason(),
        note: this.note().trim() || undefined,
        notify: this.notify(),
      });
      this.visible.set(false);
      this.done.emit(detail);
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
