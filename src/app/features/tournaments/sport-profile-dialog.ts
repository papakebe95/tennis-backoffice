import { ChangeDetectionStrategy, Component, computed, inject, model, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { classificationGroups } from './event-form';
import { TournamentApi } from './tournament.api';
import type { Gender } from './tournament.models';

export interface SportProfileTarget {
  userId: string;
  name: string;
  classificationId: string | null;
  gender: Gender | null;
  birthDate: string | null;
}

/** Federation-side edit of a player's classification, gender and birth date. */
@Component({
  selector: 'tb-sport-profile-dialog',
  imports: [FormsModule, ButtonModule, DatePickerModule, DialogModule, MessageModule, SelectModule],
  template: `
    <p-dialog [visible]="!!target()" (visibleChange)="!$event && target.set(null)" [modal]="true" [header]="t('sportProfile.title') + ' · ' + (target()?.name ?? '')" [style]="{ width: 'min(460px, 94vw)' }" [draggable]="false" (onShow)="load()">
      <p class="tb-muted hint">{{ t('sportProfile.hint') }}</p>
      @if (error()) {
        <p-message severity="error" class="msg">{{ error() }}</p-message>
      }
      <div class="tb-field">
        <label for="sp-class">{{ t('sportProfile.classification') }}</label>
        <p-select inputId="sp-class" [options]="groups()" [group]="true" optionGroupLabel="label" optionGroupChildren="items" [ngModel]="classificationId()" (ngModelChange)="classificationId.set($event)" [placeholder]="t('sportProfile.none')" [showClear]="true" [filter]="true" appendTo="body" [fluid]="true" />
      </div>
      <div class="tb-field">
        <label for="sp-gender">{{ t('sportProfile.gender') }}</label>
        <p-select inputId="sp-gender" [options]="genders()" [ngModel]="gender()" (ngModelChange)="gender.set($event)" [placeholder]="t('sportProfile.none')" [showClear]="true" appendTo="body" [fluid]="true" />
      </div>
      <div class="tb-field">
        <label for="sp-birth">{{ t('sportProfile.birthDate') }}</label>
        <p-datepicker inputId="sp-birth" [ngModel]="birthDate()" (ngModelChange)="birthDate.set($event)" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true" [maxDate]="today" appendTo="body" [fluid]="true" />
      </div>
      <ng-template #footer>
        <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="target.set(null)" />
        <p-button [label]="t('common.save')" icon="pi pi-check" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .hint { margin: 0 0 var(--tb-space-4); font-size: var(--tb-text-sm); }
    .msg { display: block; margin-bottom: var(--tb-space-4); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportProfileDialog {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);

  readonly target = model<SportProfileTarget | null>(null);
  readonly saved = output<void>();

  private readonly scale = resource({ params: () => (this.target() ? true : undefined), loader: () => this.api.classifications() });
  protected readonly groups = computed(() => classificationGroups(this.scale.value() ?? [], this.t));
  protected readonly genders = computed(() => (['MALE', 'FEMALE'] as const).map((g) => ({ label: this.t(`sportProfile.genders.${g}`), value: g })));
  protected readonly today = new Date();

  protected readonly classificationId = signal<string | null>(null);
  protected readonly gender = signal<Gender | null>(null);
  protected readonly birthDate = signal<Date | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected load() {
    const target = this.target();
    this.classificationId.set(target?.classificationId ?? null);
    this.gender.set(target?.gender ?? null);
    this.birthDate.set(target?.birthDate ? new Date(target.birthDate) : null);
    this.error.set(null);
  }

  protected async save() {
    const target = this.target();
    if (!target) return;
    const birth = this.birthDate();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.updateSportProfile(target.userId, {
        classificationId: this.classificationId(),
        gender: this.gender(),
        birthDate: birth
          ? `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`
          : null,
      });
      this.target.set(null);
      this.saved.emit();
    } catch (raw) {
      this.error.set(describeError(ApiError.from(raw), this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
