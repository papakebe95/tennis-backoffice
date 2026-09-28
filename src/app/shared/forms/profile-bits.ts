import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { I18nService } from '../../core/i18n/i18n.service';
import type { SocialLinks } from '../../features/organizations/org.models';

const NETWORKS = [
  { key: 'facebook', icon: 'pi pi-facebook', placeholder: 'https://facebook.com/…' },
  { key: 'instagram', icon: 'pi pi-instagram', placeholder: 'https://instagram.com/…' },
  { key: 'x', icon: 'pi pi-twitter', placeholder: 'https://x.com/…' },
  { key: 'youtube', icon: 'pi pi-youtube', placeholder: 'https://youtube.com/…' },
  { key: 'tiktok', icon: 'pi pi-video', placeholder: 'https://tiktok.com/@…' },
  { key: 'whatsapp', icon: 'pi pi-whatsapp', placeholder: '+221 77 …' },
] as const;

/** The six social-network fields of an organization. */
@Component({
  selector: 'tb-social-links-fields',
  imports: [FormsModule, InputTextModule],
  template: `
    <div class="grid">
      @for (n of networks; track n.key) {
        <label class="field">
          <i [class]="n.icon" aria-hidden="true"></i>
          <input
            pInputText
            [ngModel]="value()?.[n.key] ?? ''"
            (ngModelChange)="set(n.key, $event)"
            [placeholder]="n.placeholder"
            [attr.aria-label]="n.key"
            [disabled]="disabled()"
          />
        </label>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; gap: var(--tb-space-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
    .field { display: flex; align-items: center; gap: var(--tb-space-2); }
    .field i { width: 20px; color: var(--tb-text-muted); }
    input { flex: 1; min-width: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialLinksFields {
  readonly value = input<SocialLinks | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<SocialLinks>();
  protected readonly networks = NETWORKS;

  protected set(key: keyof SocialLinks, text: string) {
    this.valueChange.emit({ ...(this.value() ?? {}), [key]: text.trim() || null });
  }
}

/** Sticky bottom bar for forms with unsaved changes. */
@Component({
  selector: 'tb-save-bar',
  imports: [ButtonModule],
  template: `
    @if (dirty()) {
      <div class="bar" role="region" [attr.aria-label]="t('profile2.unsaved')">
        <span><i class="pi pi-circle-fill" aria-hidden="true"></i> {{ t('profile2.unsaved') }}</span>
        <p-button [label]="t('profile2.discard')" severity="secondary" [text]="true" (onClick)="discard.emit()" />
        <p-button [label]="t('profile2.save')" icon="pi pi-check" [loading]="saving()" [disabled]="invalid()" (onClick)="save.emit()" />
      </div>
    }
  `,
  styles: `
    .bar { position: sticky; bottom: var(--tb-space-4); z-index: 5; display: flex; align-items: center; gap: var(--tb-space-3); margin-top: var(--tb-space-6); padding: var(--tb-space-3) var(--tb-space-4); border-radius: var(--tb-radius-lg); background: var(--tb-sidebar-bg); color: #fff; box-shadow: var(--tb-shadow-lg); }
    span { flex: 1; display: flex; align-items: center; gap: var(--tb-space-2); }
    i { font-size: 0.5rem; color: #e8f86b; }
    :host ::ng-deep .p-button-text { color: #fff; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveBar {
  protected readonly t = inject(I18nService).t;
  readonly dirty = input(false);
  readonly saving = input(false);
  readonly invalid = input(false);
  readonly save = output<void>();
  readonly discard = output<void>();
}
