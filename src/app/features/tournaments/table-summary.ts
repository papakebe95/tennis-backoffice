import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../shared/format';
import type { Classification, EventInput } from './tournament.models';

type SummaryEvent = Pick<
  EventInput,
  'discipline' | 'gender' | 'ageMin' | 'ageMax' | 'minClassificationId' | 'maxClassificationId' | 'maxEntries' | 'bestOf' | 'finalSet' | 'qualifierCount'
> & { entryFee: number | string | null };

/** One line of chips describing a table: who may enter, format, rules, succession. */
@Component({
  selector: 'tb-table-summary',
  template: `
    <ul class="chips">
      @for (chip of chips(); track $index) {
        <li [class.accent]="chip.accent"><i [class]="chip.icon" aria-hidden="true"></i>{{ chip.text }}</li>
      }
    </ul>
  `,
  styles: `
    .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--tb-space-2); }
    li {
      display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px;
      border-radius: var(--tb-radius-full); background: var(--tb-surface-muted); border: 1px solid var(--tb-border);
      font-size: var(--tb-text-xs); color: var(--tb-text-muted); white-space: nowrap;
    }
    li.accent { background: var(--tb-primary-50); border-color: var(--tb-primary-200); color: var(--tb-primary-800); }
    i { font-size: 0.7rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableSummary {
  private readonly i18n = inject(I18nService);
  private readonly t = this.i18n.t;

  readonly event = input.required<SummaryEvent>();
  readonly classifications = input<readonly Classification[]>([]);
  /** Name of the table it qualifies into, when any. */
  readonly targetName = input<string | null>(null);

  protected readonly chips = computed(() => {
    const e = this.event();
    const code = (id: string | null) => this.classifications().find((c) => c.id === id)?.code ?? null;
    const weakest = code(e.minClassificationId);
    const strongest = code(e.maxClassificationId);
    const window =
      weakest && strongest
        ? this.t('tournaments.tables.windowRange', { weakest, strongest })
        : strongest
          ? this.t('tournaments.tables.atMost', { code: strongest })
          : weakest
            ? this.t('tournaments.tables.atLeast', { code: weakest })
            : this.t('tournaments.tables.anyClassification');
    const age =
      e.ageMin !== null && e.ageMax !== null
        ? this.t('tournaments.tables.ageRange', { min: e.ageMin, max: e.ageMax })
        : e.ageMin !== null
          ? this.t('tournaments.tables.ageMin', { min: e.ageMin })
          : e.ageMax !== null
            ? this.t('tournaments.tables.ageMax', { max: e.ageMax })
            : null;
    const fee = e.entryFee !== null && Number(e.entryFee) > 0 ? formatMoney(e.entryFee, this.i18n.lang()) : this.t('tournaments.tables.free');
    return [
      { icon: 'pi pi-user', text: `${this.t('tournaments.disciplines.' + e.discipline)} · ${this.t('tournaments.genders.' + e.gender)}` },
      { icon: 'pi pi-sort-amount-up', text: window },
      ...(age ? [{ icon: 'pi pi-calendar', text: age }] : []),
      ...(e.maxEntries ? [{ icon: 'pi pi-users', text: this.t('tournaments.tables.maxPlaces', { max: e.maxEntries }) }] : []),
      { icon: 'pi pi-wallet', text: fee },
      { icon: 'pi pi-clock', text: `${this.t('tournaments.tables.bestOf', { count: e.bestOf })} · ${this.t('tournaments.finalSets.' + e.finalSet)}` },
      ...(this.targetName() && e.qualifierCount
        ? [{ icon: 'pi pi-arrow-up-right', text: this.t('tournaments.tables.qualifiesInto', { count: e.qualifierCount, name: this.targetName()! }), accent: true }]
        : []),
    ] as { icon: string; text: string; accent?: boolean }[];
  });
}
