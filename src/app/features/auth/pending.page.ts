import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SessionStore } from '../../core/auth/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { MyAccessRequests } from '../access/my-access-requests';

/** Restricted landing page for accounts awaiting validation. */
@Component({
  selector: 'tb-pending-page',
  imports: [ButtonModule, MyAccessRequests],
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
        <div class="card wide">
          <div class="pending-icon"><i class="pi pi-hourglass" aria-hidden="true"></i></div>
          <h1>{{ t('auth.pending.title') }}</h1>
          @if (session.user(); as user) {
            <p class="tb-muted">{{ user.firstname }} {{ user.lastname }} · {{ user.msisdn }}</p>
          }
          <p>{{ t('auth.pending.body') }}</p>
          <tb-my-access-requests class="requests" />
          <p-button [label]="t('common.signOut')" icon="pi pi-sign-out" severity="secondary" [outlined]="true" (onClick)="session.logout()" />
        </div>
      </section>
    </div>
  `,
  styleUrl: './auth-layout.scss',
  styles: `
    .panel { align-items: start; padding-top: var(--tb-space-12); }
    .card.wide { max-width: 620px; }
    .requests { margin: var(--tb-space-6) 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingPage {
  protected readonly session = inject(SessionStore);
  protected readonly t = inject(I18nService).t;

  constructor() {
    const router = inject(Router);
    // Re-check the account every minute; once approved, move on.
    const timer = setInterval(() => void this.session.loadProfile().catch(() => undefined), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => {
      if (this.session.isAuthenticated() && !this.session.isPending()) {
        void router.navigateByUrl(this.session.homeUrl());
      }
    });
  }
}
