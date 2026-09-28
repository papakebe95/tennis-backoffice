import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { ApiError } from '../../core/api/api';
import { SessionStore } from '../../core/auth/session.store';
import { describeError } from '../../core/http/interceptors';
import { I18nService, LANGS } from '../../core/i18n/i18n.service';

@Component({
  selector: 'tb-login-page',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  templateUrl: './login.page.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly langs = LANGS;

  /** ?reason= from a sign-out or an expired session (an API code or a key). */
  readonly reason = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    identifier: ['', [Validators.required, Validators.maxLength(254)]],
    password: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly notice = computed(() => {
    const reason = this.reason();
    if (!reason) return null;
    for (const key of [`auth.errors.${reason}`, `auth.reasons.${reason}`]) {
      if (this.i18n.has(key)) return this.t(key);
    }
    return this.t('auth.reasons.sessionExpired');
  });

  protected async submit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { identifier, password } = this.form.getRawValue();
    try {
      await this.session.login(identifier.trim(), password);
      await this.router.navigateByUrl(this.session.homeUrl());
    } catch (raw) {
      const error = ApiError.from(raw);
      const key = `auth.errors.${error.code}`;
      this.error.set(error.code && this.i18n.has(key) ? this.t(key) : describeError(error, this.t));
      this.form.controls.password.reset();
    } finally {
      this.submitting.set(false);
    }
  }
}
