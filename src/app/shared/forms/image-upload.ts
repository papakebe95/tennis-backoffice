import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { OrgApi, type UploadFolder } from '../../features/organizations/org.api';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * One image (logo, banner): preview, choose/replace, remove. Uploads right
 * away and emits the public URL; checks type and size first (the API checks
 * them again).
 */
@Component({
  selector: 'tb-image-upload',
  imports: [ButtonModule],
  template: `
    @if (shape() === 'tile') {
      <input #tileFile type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pick($any($event.target))" />
      <button type="button" class="tile" [disabled]="uploading()" (click)="tileFile.click()">
        <i [class]="uploading() ? 'pi pi-spin pi-spinner' : 'pi pi-plus'" aria-hidden="true"></i>
        <span>{{ uploading() ? t('upload.uploading') : t('upload.choose') }}</span>
      </button>
    } @else {
    <div class="upload" [class.wide]="shape() === 'banner'">
      <div class="preview" [class.round]="shape() === 'logo'">
        @if (url()) {
          <img [src]="url()" alt="" />
        } @else {
          <i class="pi pi-image" aria-hidden="true"></i>
        }
      </div>
      @if (!disabled()) {
        <div class="actions">
          <input #file type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pick($any($event.target))" />
          <p-button
            [label]="uploading() ? t('upload.uploading') : url() ? t('upload.replace') : t('upload.choose')"
            icon="pi pi-upload"
            size="small"
            [outlined]="true"
            [loading]="uploading()"
            (onClick)="file.click()"
          />
          @if (url()) {
            <p-button [label]="t('upload.remove')" size="small" [text]="true" severity="secondary" (onClick)="urlChange.emit(null)" />
          }
        </div>
      }
    </div>
    }
    @if (error()) {
      <p class="tb-field-error">{{ error() }}</p>
    }
  `,
  styles: `
    .upload { display: flex; align-items: center; gap: var(--tb-space-4); }
    .upload.wide { flex-direction: column; align-items: stretch; }
    .preview { flex: none; display: grid; place-items: center; width: 72px; height: 72px; border-radius: var(--tb-radius-md); background: var(--tb-surface-muted); border: 1px dashed var(--tb-border-strong); overflow: hidden; color: var(--tb-text-subtle); }
    .preview.round { border-radius: 50%; }
    .wide .preview { width: 100%; height: 140px; }
    img { width: 100%; height: 100%; object-fit: cover; }
    .actions { display: flex; gap: var(--tb-space-2); flex-wrap: wrap; }
    :host:has(.tile) { display: block; width: 100%; height: 100%; }
    .tile { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--tb-space-2); border: 0; background: none; font: inherit; font-size: var(--tb-text-sm); color: var(--tb-primary-700); cursor: pointer; }
    .tile i { font-size: 1.25rem; }
    .tile:hover { background: var(--tb-primary-50); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUpload {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(OrgApi);

  readonly url = input<string | null | undefined>(null);
  readonly folder = input.required<UploadFolder>();
  /** 'tile': just an "add" button filling its box (photo grids). */
  readonly shape = input<'logo' | 'banner' | 'square' | 'tile'>('square');
  readonly disabled = input(false);
  readonly urlChange = output<string | null>();

  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async pick(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    if (!TYPES.includes(file.type)) return this.error.set(this.t('upload.badType'));
    if (file.size > MAX_BYTES) return this.error.set(this.t('upload.tooLarge'));
    this.uploading.set(true);
    try {
      const { url } = await this.api.upload(this.folder(), file);
      this.urlChange.emit(url);
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.uploading.set(false);
    }
  }
}
