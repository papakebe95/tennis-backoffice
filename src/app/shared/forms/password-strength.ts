import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { PASSWORD_RULES } from './password-policy';

/** Live checklist + meter for a new password. */
@Component({
  selector: 'tb-password-strength',
  template: `
    <div class="meter" [attr.data-level]="level()" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
    <ul>
      @for (rule of rules(); track rule.id) {
        <li [class.ok]="rule.ok">
          <i [class]="rule.ok ? 'pi pi-check-circle' : 'pi pi-circle'" aria-hidden="true"></i>
          {{ t(rule.label) }}
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; margin-top: var(--tb-space-2); }
    .meter { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: var(--tb-space-2); }
    .meter span { height: 4px; border-radius: 2px; background: var(--tb-border); }
    [data-level='1'] span:nth-child(-n + 1) { background: var(--tb-tone-danger-fg); }
    [data-level='2'] span:nth-child(-n + 2) { background: var(--tb-tone-warning-fg); }
    [data-level='3'] span { background: var(--tb-primary-500); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 2px var(--tb-space-4); }
    li { font-size: var(--tb-text-xs); color: var(--tb-text-muted); display: flex; align-items: center; gap: 6px; }
    li.ok { color: var(--tb-tone-success-fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordStrength {
  protected readonly t = inject(I18nService).t;
  readonly value = input<string>('');

  protected readonly rules = computed(() =>
    PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(this.value() ?? '') })),
  );

  /** 0 empty, 1 weak, 2 medium, 3 all rules met. */
  protected readonly level = computed(() => {
    if (!this.value()) return 0;
    const ok = this.rules().filter((r) => r.ok).length;
    return ok === PASSWORD_RULES.length ? 3 : ok >= 3 ? 2 : 1;
  });
}
