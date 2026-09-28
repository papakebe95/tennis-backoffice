import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { ApiError } from '../../core/api/api';
import { SessionStore } from '../../core/auth/session.store';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { matchingFields, strongPassword } from '../../shared/forms/password-policy';
import { PasswordStrength } from '../../shared/forms/password-strength';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'tb-profile-page',
  imports: [ReactiveFormsModule, DatePipe, ButtonModule, PasswordModule, MessageModule, PageHeader, StatusBadge, PasswordStrength],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly session = inject(SessionStore);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  private readonly toasts = inject(MessageService);

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

  protected async changePassword() {
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
      this.toasts.add({ severity: 'success', summary: this.t('profile.changePassword'), detail: this.t('profile.changed') });
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }

  protected showError(name: 'currentPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }
}
