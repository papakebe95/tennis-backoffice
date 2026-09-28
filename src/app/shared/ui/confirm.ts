import { ChangeDetectionStrategy, Component, computed, inject, Injectable, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { I18nService } from '../../core/i18n/i18n.service';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Extra line, e.g. a consequence ("the organization will be created"). */
  detail?: string;
  confirmLabel: string;
  severity?: 'primary' | 'danger' | 'warn';
  /** Ask for a free-text reason (stored in the audit log). */
  reason?: 'none' | 'optional' | 'required';
  reasonLabel?: string;
}

export interface ConfirmResult {
  reason?: string;
}

/**
 * Confirmation for consequential actions, with an optional reason field.
 * Resolves to null when dismissed.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<{ options: ConfirmOptions; resolve: (result: ConfirmResult | null) => void } | null>(null);

  ask(options: ConfirmOptions): Promise<ConfirmResult | null> {
    this.pending()?.resolve(null);
    return new Promise((resolve) => this.pending.set({ options, resolve }));
  }
}

/** Renders the ConfirmService dialog; mounted once in the app root. */
@Component({
  selector: 'tb-confirm-host',
  imports: [DialogModule, ButtonModule, TextareaModule, FormsModule],
  template: `
    @if (options(); as o) {
      <p-dialog
        [visible]="true"
        (visibleChange)="!$event && close(null)"
        [modal]="true"
        [header]="o.title"
        [style]="{ width: 'min(480px, 94vw)' }"
        [draggable]="false"
      >
        @if (o.message) {
          <p class="message">{{ o.message }}</p>
        }
        @if (o.detail) {
          <p class="detail">{{ o.detail }}</p>
        }
        @if (o.reason && o.reason !== 'none') {
          <div class="tb-field">
            <label for="confirm-reason">
              {{ o.reasonLabel ?? t(o.reason === 'required' ? 'confirmDialog.reasonRequired' : 'confirmDialog.reasonOptional') }}
            </label>
            <textarea pTextarea id="confirm-reason" rows="3" [(ngModel)]="reason" maxlength="1000" [autoResize]="true"></textarea>
          </div>
        }
        <ng-template #footer>
          <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="close(null)" />
          <p-button
            [label]="o.confirmLabel"
            [severity]="o.severity === 'danger' ? 'danger' : o.severity === 'warn' ? 'warn' : undefined"
            [disabled]="o.reason === 'required' && !reason().trim()"
            (onClick)="close({ reason: reason().trim() || undefined })"
          />
        </ng-template>
      </p-dialog>
    }
  `,
  styles: `
    .message { margin: 0 0 var(--tb-space-3); }
    .detail { margin: 0 0 var(--tb-space-4); color: var(--tb-text-muted); }
    textarea { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmHost {
  private readonly service = inject(ConfirmService);
  protected readonly t = inject(I18nService).t;
  protected readonly options = computed(() => this.service.pending()?.options ?? null);
  protected readonly reason = signal('');

  protected close(result: ConfirmResult | null) {
    const pending = this.service.pending();
    this.service.pending.set(null);
    this.reason.set('');
    pending?.resolve(result);
  }
}
