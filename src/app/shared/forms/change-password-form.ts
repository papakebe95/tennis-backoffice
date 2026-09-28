import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { ApiError } from '../../core/api/api';
import { SessionStore } from '../../core/auth/session.store';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { matchingFields, strongPassword } from './password-policy';
import { PasswordStrength } from './password-strength';

/** Current + new + confirmation, with live policy feedback. */
@Component({
  selector: 'tb-change-password-form',
  imports: [ReactiveFormsModule, ButtonModule, MessageModule, PasswordModule, PasswordStrength],
  template: `
    @if (error()) {
      <p-message class="msg" severity="error">{{ error() }}</p-message>
    }
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="tb-field">
        <label for="currentPassword">{{ t('profile.currentPassword') }}</label>
        <p-password inputId="currentPassword" formControlName="currentPassword" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="current-password" [invalid]="invalid('currentPassword')" />
        @if (invalid('currentPassword')) {
          <span class="tb-field-error">{{ t('profile.required') }}</span>
        }
      </div>
      <div class="tb-field">
        <label for="newPassword">{{ t('profile.newPassword') }}</label>
        <p-password inputId="newPassword" formControlName="newPassword" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="new-password" [invalid]="invalid('newPassword')" />
        <tb-password-strength [value]="newPassword()" />
      </div>
      <div class="tb-field">
        <label for="confirmPassword">{{ t('profile.confirmPassword') }}</label>
        <p-password inputId="confirmPassword" formControlName="confirmPassword" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="new-password" [invalid]="invalid('confirmPassword') || mismatch()" />
        @if (mismatch()) {
          <span class="tb-field-error">{{ t('profile.mismatch') }}</span>
        }
      </div>
      <p-button type="submit" [label]="t('profile.changePassword')" icon="pi pi-lock" [loading]="saving()" [fluid]="fluid" />
    </form>
  `,
  styles: `.msg { display: block; margin-bottom: var(--tb-space-5); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordForm {
  protected readonly t = inject(I18nService).t;
  private readonly session = inject(SessionStore);
  readonly changed = output<void>();
  protected readonly fluid = false;

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, strongPassword, Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchingFields('newPassword', 'confirmPassword') },
  );
  protected readonly newPassword = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalid(name: 'currentPassword' | 'newPassword' | 'confirmPassword') {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected mismatch() {
    return this.form.hasError('mismatch') && this.form.controls.confirmPassword.touched;
  }

  protected async submit() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    if (currentPassword === newPassword) {
      this.error.set(this.t('profile.sameAsCurrent'));
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.session.changePassword(currentPassword, newPassword);
      this.form.reset();
      this.changed.emit();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
