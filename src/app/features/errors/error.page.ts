import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { I18nService } from '../../core/i18n/i18n.service';

/** Forbidden / not-found page; the variant comes from route data. */
@Component({
  selector: 'tb-error-page',
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="error">
      <span class="code">{{ variant() === 'forbidden' ? 403 : 404 }}</span>
      <h1>{{ t('errors.' + variant() + 'Page.title') }}</h1>
      <p class="tb-muted">{{ t('errors.' + variant() + 'Page.body') }}</p>
      <a routerLink="/dashboard"><p-button [label]="t('errors.goHome')" icon="pi pi-home" /></a>
    </div>
  `,
  styles: `
    .error { display: grid; justify-items: center; text-align: center; gap: var(--tb-space-3); padding: var(--tb-space-12) var(--tb-space-4); }
    .code { font-size: 4rem; font-weight: var(--tb-weight-bold); color: var(--tb-primary-200); line-height: 1; }
    h1 { font-size: var(--tb-text-2xl); }
    p { margin: 0 0 var(--tb-space-4); max-width: 420px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  protected readonly t = inject(I18nService).t;
  readonly variant = input<'forbidden' | 'notFound'>('notFound');
}
