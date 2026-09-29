import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { I18nService } from '../../core/i18n/i18n.service';
import type { Surface, TournamentDetail, TournamentInput } from './tournament.models';

/** Editable general information; dates as Date for the pickers. */
export interface TournamentFormValue {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  location: string;
  surface: Surface | null;
  category: string;
  description: string;
  visibility: 'PUBLIC' | 'PRIVATE';
}

export const emptyTournamentForm = (): TournamentFormValue => ({
  name: '',
  startDate: null,
  endDate: null,
  registrationOpensAt: null,
  registrationClosesAt: null,
  location: '',
  surface: null,
  category: '',
  description: '',
  visibility: 'PUBLIC',
});

export const tournamentFormFrom = (t: TournamentDetail): TournamentFormValue => ({
  name: t.name,
  startDate: new Date(t.startDate),
  endDate: new Date(t.endDate),
  registrationOpensAt: t.registrationOpensAt ? new Date(t.registrationOpensAt) : null,
  registrationClosesAt: t.registrationClosesAt ? new Date(t.registrationClosesAt) : null,
  location: t.location ?? '',
  surface: t.surface,
  category: t.category ?? '',
  description: t.description ?? '',
  visibility: t.visibility,
});

/**
 * Calendar day picked in the UI → the API's date. Tournaments run on Dakar
 * time (UTC), so the day is sent as UTC midnight, or the end of that day for
 * closing dates.
 */
export function dayIso(date: Date, endOfDay = false): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${endOfDay ? '23:59:00' : '00:00:00'}Z`;
}

export function toTournamentInput(v: TournamentFormValue): TournamentInput {
  return {
    name: v.name.trim(),
    startDate: v.startDate ? dayIso(v.startDate) : undefined,
    endDate: v.endDate ? dayIso(v.endDate, true) : undefined,
    registrationOpensAt: v.registrationOpensAt ? dayIso(v.registrationOpensAt) : null,
    registrationClosesAt: v.registrationClosesAt ? dayIso(v.registrationClosesAt, true) : null,
    location: v.location.trim() || null,
    surface: v.surface,
    category: v.category.trim() || null,
    description: v.description.trim() || null,
    visibility: v.visibility,
  };
}

/** Problems that stop the form from being saved (i18n keys). */
export function tournamentFormErrors(v: TournamentFormValue): string[] {
  const errors: string[] = [];
  if (v.name.trim().length < 3) errors.push('tournaments.form.name');
  if (!v.startDate || !v.endDate || v.endDate < v.startDate) errors.push('tournaments.lifecycle.blockers.INVALID_DATES');
  if (v.registrationClosesAt && v.endDate && v.registrationClosesAt > v.endDate) {
    errors.push('tournaments.lifecycle.blockers.INVALID_DATES');
  }
  return errors;
}

@Component({
  selector: 'tb-tournament-fields',
  imports: [FormsModule, DatePickerModule, InputTextModule, SelectModule, TextareaModule],
  template: `
    @let v = value();
    <div class="tb-field">
      <label for="tf-name">{{ t('tournaments.form.name') }}</label>
      <input pInputText id="tf-name" [ngModel]="v.name" (ngModelChange)="patch('name', $event)" maxlength="120" [disabled]="disabled()" />
    </div>
    <div class="two">
      <div class="tb-field">
        <label for="tf-start">{{ t('tournaments.form.start') }}</label>
        <p-datepicker inputId="tf-start" [ngModel]="v.startDate" (ngModelChange)="patch('startDate', $event)" dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" [fluid]="true" [disabled]="disabled()" />
      </div>
      <div class="tb-field">
        <label for="tf-end">{{ t('tournaments.form.end') }}</label>
        <p-datepicker inputId="tf-end" [ngModel]="v.endDate" (ngModelChange)="patch('endDate', $event)" [minDate]="v.startDate" dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" [fluid]="true" [disabled]="disabled()" />
      </div>
    </div>
    <div class="two">
      <div class="tb-field">
        <label for="tf-ropen">{{ t('tournaments.form.registrationOpens') }}</label>
        <p-datepicker inputId="tf-ropen" [ngModel]="v.registrationOpensAt" (ngModelChange)="patch('registrationOpensAt', $event)" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true" appendTo="body" [fluid]="true" [disabled]="disabled()" />
      </div>
      <div class="tb-field">
        <label for="tf-rclose">{{ t('tournaments.form.registrationCloses') }}</label>
        <p-datepicker inputId="tf-rclose" [ngModel]="v.registrationClosesAt" (ngModelChange)="patch('registrationClosesAt', $event)" [maxDate]="v.endDate" dateFormat="dd/mm/yy" [showIcon]="true" [showClear]="true" appendTo="body" [fluid]="true" [disabled]="disabled()" />
      </div>
    </div>
    <span class="tb-field-hint">{{ t('tournaments.form.registrationHint') }}</span>
    <div class="two">
      <div class="tb-field">
        <label for="tf-location">{{ t('tournaments.form.location') }}</label>
        <input pInputText id="tf-location" [ngModel]="v.location" (ngModelChange)="patch('location', $event)" maxlength="200" [placeholder]="t('tournaments.form.locationHint')" [disabled]="disabled()" />
      </div>
      <div class="tb-field">
        <label for="tf-surface">{{ t('tournaments.form.surface') }}</label>
        <p-select inputId="tf-surface" [options]="surfaceOptions()" [ngModel]="v.surface" (ngModelChange)="patch('surface', $event)" [showClear]="true" appendTo="body" [fluid]="true" [disabled]="disabled()" />
      </div>
    </div>
    <div class="two">
      <div class="tb-field">
        <label for="tf-category">{{ t('tournaments.form.category') }}</label>
        <input pInputText id="tf-category" [ngModel]="v.category" (ngModelChange)="patch('category', $event)" maxlength="80" [disabled]="disabled()" />
        <span class="tb-field-hint">{{ t('tournaments.form.categoryHint') }}</span>
      </div>
      <div class="tb-field">
        <label for="tf-visibility">{{ t('tournaments.form.visibility') }}</label>
        <p-select inputId="tf-visibility" [options]="visibilityOptions()" [ngModel]="v.visibility" (ngModelChange)="patch('visibility', $event)" appendTo="body" [fluid]="true" [disabled]="disabled()" />
      </div>
    </div>
    <div class="tb-field">
      <label for="tf-description">{{ t('tournaments.form.description') }}</label>
      <textarea pTextarea id="tf-description" rows="4" [autoResize]="true" [ngModel]="v.description" (ngModelChange)="patch('description', $event)" maxlength="4000" [disabled]="disabled()"></textarea>
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-3); }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--tb-space-3); }
    .tb-field { margin: 0; }
    input, textarea { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentFields {
  protected readonly t = inject(I18nService).t;
  readonly value = model.required<TournamentFormValue>();
  readonly disabled = input(false);

  protected readonly surfaceOptions = computed(() =>
    (['HARD', 'CLAY', 'GRASS', 'INDOOR'] as const).map((v) => ({ label: this.t(`tournaments.surfaces.${v}`), value: v })),
  );
  protected readonly visibilityOptions = computed(() =>
    (['PUBLIC', 'PRIVATE'] as const).map((v) => ({ label: this.t(`tournaments.form.visibilities.${v}`), value: v })),
  );

  protected patch<K extends keyof TournamentFormValue>(key: K, value: TournamentFormValue[K]) {
    this.value.update((v) => ({ ...v, [key]: value }));
  }
}
