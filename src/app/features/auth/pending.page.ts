import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SessionStore } from '../../core/auth/session.store';
import { I18nService } from '../../core/i18n/i18n.service';

/** Restricted landing page for accounts awaiting validation. */
@Component({
  selector: 'tb-pending-page',
  imports: [ButtonModule],
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
          <div class="pending-icon"><i class="pi pi-hourglass" aria-hidden="true"></i></div>
          <h1>{{ t('auth.pending.title') }}</h1>
          @if (session.user(); as user) {
            <p class="tb-muted">{{ user.firstname }} {{ user.lastname }} · {{ user.msisdn }}</p>
          }
          <p>{{ t('auth.pending.body') }}</p>
          <p class="tb-muted">{{ t('auth.pending.next') }}</p>
          <p-button [label]="t('common.signOut')" icon="pi pi-sign-out" severity="secondary" [outlined]="true" (onClick)="session.logout()" />
        </div>
      </section>
    </div>
  `,
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingPage {
  protected readonly session = inject(SessionStore);
  protected readonly t = inject(I18nService).t;
}
