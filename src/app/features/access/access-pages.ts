import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { ChangePasswordForm } from '../../shared/forms/change-password-form';
import { matchingFields, strongPassword } from '../../shared/forms/password-policy';
import { PasswordStrength } from '../../shared/forms/password-strength';
import { PageHeader } from '../../shared/ui/page-header';
import { AccessRequestForm } from './access-request-form';
import { AccessApi, type AccessRequestInput } from './access.api';
import { MyAccessRequests } from './my-access-requests';

/** Public back-office sign-up: account + first access request. */
@Component({
  selector: 'tb-register-page',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, PasswordModule, PasswordStrength, AccessRequestForm],
  template: `
    <div class="auth register">
      <section class="hero" aria-hidden="true">
        <div class="hero-text">
          <span class="ball"></span>
          <h2>{{ t('app.name') }}</h2>
          <p>{{ t('app.tagline') }}</p>
        </div>
      </section>
      <section class="panel">
        <div class="lang" role="group" [attr.aria-label]="t('common.language')">
          @for (lang of langs; track lang) {
            <button type="button" [class.active]="i18n.lang() === lang" (click)="i18n.setLang(lang)">{{ lang.toUpperCase() }}</button>
          }
        </div>
        <form class="card wide" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h1>{{ t('register.title') }}</h1>
          <p class="tb-muted">{{ t('register.subtitle') }}</p>
          <p-message severity="info" class="msg">{{ t('register.existingPlayer') }}</p-message>
          @if (error()) {
            <p-message severity="error" class="msg">{{ error() }}</p-message>
          }

          <h2 class="section">{{ t('register.account') }}</h2>
          <div class="grid">
            <div class="tb-field">
              <label for="firstname">{{ t('register.firstname') }}</label>
              <input pInputText id="firstname" formControlName="firstname" autocomplete="given-name" [invalid]="invalid('firstname')" />
            </div>
            <div class="tb-field">
              <label for="lastname">{{ t('register.lastname') }}</label>
              <input pInputText id="lastname" formControlName="lastname" autocomplete="family-name" [invalid]="invalid('lastname')" />
            </div>
            <div class="tb-field">
              <label for="msisdn">{{ t('register.phone') }}</label>
              <input pInputText id="msisdn" formControlName="msisdn" autocomplete="tel" inputmode="tel" placeholder="+221 77 123 45 67" [invalid]="invalid('msisdn')" />
            </div>
            <div class="tb-field">
              <label for="email">{{ t('register.email') }}</label>
              <input pInputText id="email" type="email" formControlName="email" autocomplete="email" [invalid]="invalid('email')" />
              @if (invalid('email')) {
                <span class="tb-field-error">{{ t('register.invalidEmail') }}</span>
              }
            </div>
            <div class="tb-field">
              <label for="password">{{ t('register.password') }}</label>
              <p-password inputId="password" formControlName="password" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="new-password" [invalid]="invalid('password')" />
            </div>
            <div class="tb-field">
              <label for="confirm">{{ t('register.confirmPassword') }}</label>
              <p-password inputId="confirm" formControlName="confirm" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="new-password" [invalid]="invalid('confirm') || (form.hasError('mismatch') && form.controls.confirm.touched)" />
              @if (form.hasError('mismatch') && form.controls.confirm.touched) {
                <span class="tb-field-error">{{ t('profile.mismatch') }}</span>
              }
            </div>
          </div>
          <tb-password-strength [value]="password()" />

          <div class="section-gap"></div>
          <tb-access-request-form (value)="request.set($event)" />
          @if (submitted() && !request()) {
            <p class="tb-field-error">{{ t('register.chooseProfile') }}</p>
          }

          <p-button type="submit" [label]="t('register.submit')" icon="pi pi-send" [loading]="submitting()" [fluid]="true" />
          <p class="switch">{{ t('register.haveAccount') }} <a routerLink="/login">{{ t('register.signIn') }}</a></p>
        </form>
      </section>
    </div>
  `,
  styleUrls: ['../auth/auth-layout.scss', './register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  protected readonly langs = LANGS;
  private readonly api = inject(AccessApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      firstname: ['', [Validators.required, Validators.maxLength(60)]],
      lastname: ['', [Validators.required, Validators.maxLength(60)]],
      msisdn: ['', [Validators.required, Validators.maxLength(30)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, strongPassword, Validators.maxLength(72)]],
      confirm: ['', Validators.required],
    },
    { validators: matchingFields('password', 'confirm') },
  );
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly request = signal<AccessRequestInput | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalid(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected async submit() {
    this.submitted.set(true);
    const request = this.request();
    if (this.form.invalid || !request || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const { confirm: _confirm, ...account } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    try {
      const { accessToken } = await this.api.register({ ...account, ...request });
      await this.session.start(accessToken);
      await this.router.navigateByUrl(this.session.homeUrl());
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.submitting.set(false);
    }
  }
}

/** /access inside the shell: an active user's requests (e.g. a player asking for a role). */
@Component({
  selector: 'tb-access-page',
  imports: [PageHeader, MyAccessRequests],
  template: `
    <tb-page-header [title]="t('access.title')" [subtitle]="t('access.subtitle')" />
    <div class="container"><tb-my-access-requests /></div>
  `,
  styles: `.container { max-width: 760px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessPage {
  protected readonly t = inject(I18nService).t;
}

/** Forced password change after an administrator reset. */
@Component({
  selector: 'tb-forced-password-page',
  imports: [ChangePasswordForm, ButtonModule],
  template: `
    <div class="auth">
      <section class="hero" aria-hidden="true">
        <div class="hero-text">
          <span class="ball"></span>
          <h2>{{ t('app.name') }}</h2>
          <p>{{ t('app.tagline') }}</p>
        </div>
      </section>
      <section class="panel">
        <div class="card">
          <div class="pending-icon"><i class="pi pi-key" aria-hidden="true"></i></div>
          <h1>{{ t('forcedPassword.title') }}</h1>
          <p class="tb-muted">{{ t('forcedPassword.body') }}</p>
          <tb-change-password-form (changed)="done()" />
          <p-button class="signout" [label]="t('common.signOut')" severity="secondary" [text]="true" (onClick)="session.logout()" />
        </div>
      </section>
    </div>
  `,
  styleUrl: '../auth/auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForcedPasswordPage {
  protected readonly t = inject(I18nService).t;
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected done() {
    void this.router.navigateByUrl(this.session.homeUrl());
  }
}
