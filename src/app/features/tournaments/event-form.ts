import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { I18nService } from '../../core/i18n/i18n.service';
import type { Classification, EventInput } from './tournament.models';

export interface TableOption {
  value: string;
  label: string;
}

/** Groups the scale by series for the classification pickers. */
export function classificationGroups(scale: readonly Classification[], t: I18nService['t']) {
  const groups = new Map<string, { label: string; items: { label: string; value: string }[] }>();
  for (const c of scale) {
    const group = groups.get(c.series) ?? { label: t(`classificationSeries.${c.series}`), items: [] };
    group.items.push({ label: c.label === c.code ? c.code : `${c.code} · ${c.label}`, value: c.id });
    groups.set(c.series, group);
  }
  return [...groups.values()];
}

/**
 * Fields of one tournament table: eligibility (discipline, category, age,
 * classification window), organization and match rules, and where its best
 * players qualify. Edits `value` in place; saving is the parent's job.
 */
@Component({
  selector: 'tb-event-form',
  imports: [FormsModule, InputNumberModule, InputTextModule, MessageModule, SelectModule, ToggleSwitchModule],
  template: `
    @let v = value();
    <div class="tb-field">
      <label [for]="id('name')">{{ t('tournaments.eventForm.name') }}</label>
      <input pInputText [id]="id('name')" [ngModel]="v.name" (ngModelChange)="patch('name', $event)" maxlength="80" [placeholder]="t('tournaments.eventForm.namePlaceholder')" />
    </div>

    @if (drawLocked()) {
      <p-message severity="info" class="msg">{{ t('tournaments.eventForm.drawLocked') }}</p-message>
    }

    <fieldset>
      <legend>{{ t('tournaments.eventForm.eligibility') }}</legend>
      <div class="two">
        <div class="tb-field">
          <label [for]="id('discipline')">{{ t('tournaments.eventForm.discipline') }}</label>
          <p-select [inputId]="id('discipline')" [options]="disciplineOptions()" [ngModel]="v.discipline" (ngModelChange)="patch('discipline', $event)" [disabled]="drawLocked()" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('gender')">{{ t('tournaments.eventForm.gender') }}</label>
          <p-select [inputId]="id('gender')" [options]="genderOptions()" [ngModel]="v.gender" (ngModelChange)="patch('gender', $event)" appendTo="body" [fluid]="true" />
        </div>
      </div>
      <div class="two">
        <div class="tb-field">
          <label [for]="id('weakest')">{{ t('tournaments.eventForm.weakest') }}</label>
          <p-select [inputId]="id('weakest')" [options]="classificationOptions()" [group]="true" optionGroupLabel="label" optionGroupChildren="items" [ngModel]="v.minClassificationId" (ngModelChange)="patch('minClassificationId', $event)" [placeholder]="t('tournaments.eventForm.noLimit')" [showClear]="true" [filter]="true" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('strongest')">{{ t('tournaments.eventForm.strongest') }}</label>
          <p-select [inputId]="id('strongest')" [options]="classificationOptions()" [group]="true" optionGroupLabel="label" optionGroupChildren="items" [ngModel]="v.maxClassificationId" (ngModelChange)="patch('maxClassificationId', $event)" [placeholder]="t('tournaments.eventForm.noLimit')" [showClear]="true" [filter]="true" appendTo="body" [fluid]="true" />
        </div>
      </div>
      <span class="tb-field-hint">{{ t('tournaments.eventForm.classificationHint') }}</span>
      <div class="two">
        <div class="tb-field">
          <label [for]="id('ageMin')">{{ t('tournaments.eventForm.ageMin') }}</label>
          <p-inputnumber [inputId]="id('ageMin')" [ngModel]="v.ageMin" (ngModelChange)="patch('ageMin', $event)" [min]="5" [max]="99" [placeholder]="t('tournaments.eventForm.noLimit')" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('ageMax')">{{ t('tournaments.eventForm.ageMax') }}</label>
          <p-inputnumber [inputId]="id('ageMax')" [ngModel]="v.ageMax" (ngModelChange)="patch('ageMax', $event)" [min]="5" [max]="99" [placeholder]="t('tournaments.eventForm.noLimit')" [fluid]="true" />
          <span class="tb-field-hint">{{ t('tournaments.eventForm.ageHint') }}</span>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>{{ t('tournaments.eventForm.organisation') }}</legend>
      <div class="three">
        <div class="tb-field">
          <label [for]="id('format')">{{ t('tournaments.eventForm.format') }}</label>
          <p-select [inputId]="id('format')" [options]="formatOptions()" [ngModel]="v.format" (ngModelChange)="patch('format', $event)" [disabled]="drawLocked()" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('places')">{{ t('tournaments.eventForm.maxEntries') }}</label>
          <p-inputnumber [inputId]="id('places')" [ngModel]="v.maxEntries" (ngModelChange)="patch('maxEntries', $event)" [min]="2" [max]="256" [placeholder]="t('tournaments.eventForm.noLimit')" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('seeds')">{{ t('tournaments.eventForm.seedCount') }}</label>
          <p-inputnumber [inputId]="id('seeds')" [ngModel]="v.seedCount" (ngModelChange)="patch('seedCount', $event ?? 0)" [min]="0" [max]="32" [disabled]="drawLocked()" [fluid]="true" />
        </div>
      </div>
      <div class="tb-field">
        <label [for]="id('fee')">{{ t('tournaments.eventForm.entryFee') }}</label>
        <p-inputnumber [inputId]="id('fee')" [ngModel]="v.entryFee" (ngModelChange)="patch('entryFee', $event)" [min]="0" [max]="10000000" [useGrouping]="true" [fluid]="true" />
      </div>
    </fieldset>

    <fieldset>
      <legend>{{ t('tournaments.eventForm.rules') }}</legend>
      <div class="three">
        <div class="tb-field">
          <label [for]="id('bestOf')">{{ t('tournaments.eventForm.bestOf') }}</label>
          <p-select [inputId]="id('bestOf')" [options]="bestOfOptions" [ngModel]="v.bestOf" (ngModelChange)="patch('bestOf', $event)" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('finalSet')">{{ t('tournaments.eventForm.finalSet') }}</label>
          <p-select [inputId]="id('finalSet')" [options]="finalSetOptions()" [ngModel]="v.finalSet" (ngModelChange)="patch('finalSet', $event)" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <label [for]="id('duration')">{{ t('tournaments.eventForm.duration') }}</label>
          <p-inputnumber [inputId]="id('duration')" [ngModel]="v.matchDurationMinutes" (ngModelChange)="patch('matchDurationMinutes', $event ?? 90)" [min]="15" [max]="600" [step]="15" [fluid]="true" />
        </div>
      </div>
      <label class="switch">
        <p-toggleswitch [ngModel]="v.noAd" (ngModelChange)="patch('noAd', $event)" [inputId]="id('noAd')" />
        <span>{{ t('tournaments.eventForm.noAd') }}</span>
      </label>
    </fieldset>

    @if (tableOptions().length) {
      <fieldset>
        <legend>{{ t('tournaments.eventForm.succession') }}</legend>
        <div class="two">
          <div class="tb-field">
            <label [for]="id('into')">{{ t('tournaments.eventForm.qualifiesInto') }}</label>
            <p-select [inputId]="id('into')" [options]="tableOptions()" [ngModel]="v.qualifiesIntoEventId" (ngModelChange)="setTarget($event)" [placeholder]="t('tournaments.eventForm.noTarget')" [showClear]="true" appendTo="body" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label [for]="id('qualifiers')">{{ t('tournaments.eventForm.qualifierCount') }}</label>
            <p-inputnumber [inputId]="id('qualifiers')" [ngModel]="v.qualifierCount" (ngModelChange)="patch('qualifierCount', $event ?? 0)" [min]="0" [max]="64" [disabled]="!v.qualifiesIntoEventId || drawLocked()" [fluid]="true" />
          </div>
        </div>
        <span class="tb-field-hint">{{ t('tournaments.eventForm.successionHint') }}</span>
      </fieldset>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-4); }
    fieldset { border: 1px solid var(--tb-border); border-radius: var(--tb-radius-md); padding: var(--tb-space-4); margin: 0; display: grid; gap: var(--tb-space-3); min-width: 0; }
    legend { padding: 0 var(--tb-space-2); font-weight: var(--tb-weight-semibold); font-size: var(--tb-text-sm); }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--tb-space-3); }
    .three { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--tb-space-3); }
    .tb-field { margin: 0; }
    .switch { display: inline-flex; align-items: center; gap: var(--tb-space-2); cursor: pointer; }
    input { width: 100%; }
    .msg { display: block; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventForm {
  protected readonly t = inject(I18nService).t;

  readonly value = model.required<EventInput>();
  readonly classifications = input<readonly Classification[]>([]);
  /** The tournament's other tables this one could qualify into. */
  readonly tables = input<readonly TableOption[]>([]);
  readonly drawLocked = input(false);
  /** Prefix for element ids, so several forms can share a page. */
  readonly idPrefix = input('ev');

  protected readonly tableOptions = computed(() => [...this.tables()]);
  protected readonly classificationOptions = computed(() => classificationGroups(this.classifications(), this.t));
  protected readonly disciplineOptions = computed(() =>
    (['SINGLES', 'DOUBLES'] as const).map((v) => ({ label: this.t(`tournaments.disciplines.${v}`), value: v })),
  );
  protected readonly genderOptions = computed(() =>
    (['MEN', 'WOMEN', 'MIXED', 'OPEN'] as const).map((v) => ({ label: this.t(`tournaments.genders.${v}`), value: v })),
  );
  protected readonly formatOptions = computed(() =>
    (['SINGLE_ELIMINATION', 'ROUND_ROBIN'] as const).map((v) => ({ label: this.t(`tournaments.formats.${v}`), value: v })),
  );
  protected readonly finalSetOptions = computed(() =>
    (['TIEBREAK', 'SUPER_TIEBREAK', 'ADVANTAGE'] as const).map((v) => ({ label: this.t(`tournaments.finalSets.${v}`), value: v })),
  );
  protected readonly bestOfOptions = [1, 3, 5].map((n) => ({ label: String(n), value: n }));

  protected id(field: string) {
    return `${this.idPrefix()}-${field}`;
  }

  protected patch<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    this.value.update((v) => ({ ...v, [key]: value }));
  }

  /** Choosing a target defaults to two qualifiers; clearing it sends none. */
  protected setTarget(target: string | null) {
    this.value.update((v) => ({
      ...v,
      qualifiesIntoEventId: target,
      qualifierCount: target ? v.qualifierCount || 2 : 0,
    }));
  }
}
