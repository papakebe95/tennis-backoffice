import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiError } from '../../core/api/api';
import { describeError } from '../../core/http/interceptors';
import { I18nService } from '../../core/i18n/i18n.service';
import { checkResult, type ScoreError, type SetScore } from './tennis-score';
import { TournamentApi } from './tournament.api';
import { sideName, type MatchOutcome, type TournamentMatch } from './tournament.models';

interface SetRow {
  side1: number | null;
  side2: number | null;
  tiebreak1: number | null;
  tiebreak2: number | null;
  superTiebreak: boolean;
}

const emptyRow = (): SetRow => ({ side1: null, side2: null, tiebreak1: null, tiebreak2: null, superTiebreak: false });

/**
 * Result entry: outcome (played, retirement, walkover), sets with tiebreaks
 * and match tiebreak, checked live with the same rules as the API.
 */
@Component({
  selector: 'tb-score-form',
  imports: [FormsModule, ButtonModule, InputNumberModule, MessageModule, SelectButtonModule, TextareaModule, ToggleSwitchModule],
  template: `
    @let m = match();
    <div class="tb-field">
      <span class="label">{{ t('matches.score.outcome') }}</span>
      <p-selectbutton [options]="outcomes()" [ngModel]="outcome()" (ngModelChange)="outcome.set($event ?? 'PLAYED')" optionLabel="label" optionValue="value" [allowEmpty]="false" [ariaLabel]="t('matches.score.outcome')" />
    </div>

    @if (outcome() !== 'PLAYED') {
      <div class="tb-field">
        <span class="label">{{ t('matches.score.loser') }}</span>
        <p-selectbutton [options]="sides()" [ngModel]="loserSide()" (ngModelChange)="loserSide.set($event)" optionLabel="label" optionValue="value" [ariaLabel]="t('matches.score.loser')" />
      </div>
    }

    @if (outcome() !== 'WALKOVER') {
      <table class="sets">
        <thead>
          <tr>
            <th></th>
            @for (row of rows(); track $index; let i = $index) {
              <th>{{ t('matches.score.set', { n: i + 1 }) }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (side of [1, 2]; track side) {
            <tr>
              <th scope="row" class="who">{{ side === 1 ? name1() : name2() }}</th>
              @for (row of rows(); track $index; let i = $index) {
                <td>
                  @if (!row.superTiebreak) {
                    <p-inputnumber [inputId]="'g' + side + '-' + i" [ngModel]="side === 1 ? row.side1 : row.side2" (ngModelChange)="patch(i, side === 1 ? 'side1' : 'side2', $event)" [min]="0" [max]="99" [ariaLabel]="t('matches.score.set', { n: i + 1 }) + ' · ' + (side === 1 ? name1() : name2())" inputStyleClass="games" />
                  }
                  @if (row.superTiebreak || needsTiebreak(row)) {
                    <p-inputnumber [inputId]="'tb' + side + '-' + i" [ngModel]="side === 1 ? row.tiebreak1 : row.tiebreak2" (ngModelChange)="patch(i, side === 1 ? 'tiebreak1' : 'tiebreak2', $event)" [min]="0" [max]="99" [ariaLabel]="(row.superTiebreak ? t('matches.score.superTiebreak') : t('matches.score.tiebreak')) + ' · ' + (side === 1 ? name1() : name2())" inputStyleClass="tb" [placeholder]="row.superTiebreak ? '10' : '7'" />
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      <div class="set-tools">
        @if (rows().length < m.event.bestOf) {
          <p-button [label]="t('matches.score.addSet')" icon="pi pi-plus" [text]="true" size="small" (onClick)="addSet()" />
        }
        @if (rows().length > 1) {
          <p-button [label]="t('matches.score.removeSet')" icon="pi pi-minus" [text]="true" size="small" severity="secondary" (onClick)="rows.set(rows().slice(0, -1))" />
        }
        @if (m.event.finalSet === 'SUPER_TIEBREAK' && rows().length === m.event.bestOf) {
          <label class="switch">
            <p-toggleswitch [ngModel]="rows()[rows().length - 1].superTiebreak" (ngModelChange)="patch(rows().length - 1, 'superTiebreak', $event)" />
            <span>{{ t('matches.score.superTiebreak') }}</span>
          </label>
        }
      </div>
    }

    <div class="verdict" role="status" aria-live="polite">
      @if (check().ok) {
        <span class="ok"><i class="pi pi-trophy" aria-hidden="true"></i> {{ t('matches.score.winner', { name: winnerName() }) }}</span>
      } @else {
        @for (e of issues(); track $index) {
          <span class="err">{{ errorText(e) }}</span>
        }
      }
    </div>

    @if (m.resultStatus === 'VALIDATED') {
      <div class="tb-field">
        <label for="sf-reason">{{ t('matches.score.correctionReason') }}</label>
        <textarea pTextarea id="sf-reason" rows="2" [autoResize]="true" [ngModel]="reason()" (ngModelChange)="reason.set($event)" maxlength="300"></textarea>
        <span class="tb-field-hint">{{ t('matches.score.correctionHint') }}</span>
      </div>
    }
    @if (error()) {
      <p-message severity="error" class="msg">{{ error() }}</p-message>
    }
    <div class="actions">
      <p-button [label]="mayValidate() ? t('matches.score.submitValidate') : t('matches.score.submit')" icon="pi pi-check" [loading]="saving()" [disabled]="!valid()" (onClick)="submit()" />
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--tb-space-3); }
    .label { font-weight: var(--tb-weight-medium); font-size: var(--tb-text-sm); }
    .tb-field { margin: 0; display: grid; gap: var(--tb-space-2); }
    .sets { border-collapse: separate; border-spacing: 6px 4px; margin-left: -6px; }
    .sets th { font-size: var(--tb-text-xs); color: var(--tb-text-muted); font-weight: var(--tb-weight-semibold); text-align: center; }
    .sets .who { text-align: left; font-size: var(--tb-text-sm); color: var(--tb-text); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sets td { vertical-align: top; }
    .sets td { display: table-cell; }
    :host ::ng-deep .games { width: 52px; text-align: center; font-weight: var(--tb-weight-semibold); }
    :host ::ng-deep .tb { width: 52px; margin-top: 4px; text-align: center; font-size: var(--tb-text-xs); }
    .set-tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-2); }
    .switch { display: inline-flex; align-items: center; gap: var(--tb-space-2); font-size: var(--tb-text-sm); cursor: pointer; }
    .verdict { display: flex; flex-wrap: wrap; gap: var(--tb-space-2); min-height: 28px; }
    .ok { color: var(--tb-tone-success-fg); font-weight: var(--tb-weight-semibold); }
    .err { font-size: var(--tb-text-sm); padding: 2px 10px; border-radius: var(--tb-radius-full); background: var(--tb-tone-warning-bg); color: var(--tb-tone-warning-fg); }
    textarea { width: 100%; }
    .msg { display: block; }
    .actions { display: flex; justify-content: flex-end; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreForm {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(TournamentApi);

  readonly match = input.required<TournamentMatch>();
  readonly mayValidate = input(false);
  readonly saved = output<TournamentMatch>();

  protected readonly emptyRow = emptyRow;
  protected readonly outcome = signal<MatchOutcome>('PLAYED');
  protected readonly loserSide = signal<1 | 2 | null>(null);
  protected readonly rows = signal<SetRow[]>([]);
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly serverIssues = signal<ScoreError[]>([]);

  protected readonly name1 = computed(() => sideName(this.match().side1));
  protected readonly name2 = computed(() => sideName(this.match().side2));
  protected readonly outcomes = computed(() =>
    (['PLAYED', 'RETIRED', 'WALKOVER'] as const).map((v) => ({ label: this.t(`matches.score.outcomes.${v}`), value: v })),
  );
  protected readonly sides = computed(() => [
    { label: this.name1(), value: 1 },
    { label: this.name2(), value: 2 },
  ]);

  /** Rows as scores; empty rows are ignored (a partial row is an error). */
  private readonly scores = computed<SetScore[]>(() =>
    this.outcome() === 'WALKOVER'
      ? []
      : this.rows()
          .filter((r) => r.superTiebreak ? r.tiebreak1 !== null || r.tiebreak2 !== null : r.side1 !== null || r.side2 !== null)
          .map((r) => {
            if (!r.superTiebreak) return { side1: r.side1 ?? -1, side2: r.side2 ?? -1, tiebreak1: r.tiebreak1, tiebreak2: r.tiebreak2 };
            const t1 = r.tiebreak1 ?? 0;
            const t2 = r.tiebreak2 ?? 0;
            return { side1: t1 > t2 ? 1 : 0, side2: t2 > t1 ? 1 : 0, tiebreak1: r.tiebreak1, tiebreak2: r.tiebreak2, superTiebreak: true };
          }),
  );
  protected readonly check = computed(() => checkResult(this.match().event, this.outcome(), this.scores(), this.loserSide()));
  protected readonly issues = computed(() => (this.serverIssues().length ? this.serverIssues() : this.check().ok ? [] : (this.check() as { errors: ScoreError[] }).errors));
  protected readonly winnerName = computed(() => {
    const c = this.check();
    return c.ok ? (c.winnerSide === 1 ? this.name1() : this.name2()) : '';
  });
  protected readonly valid = computed(
    () => this.check().ok && !this.saving() && (this.match().resultStatus !== 'VALIDATED' || !!this.reason().trim()),
  );

  constructor() {
    // Start from the stored result, or from empty sets.
    effect(() => {
      const m = this.match();
      this.outcome.set(m.outcome ?? 'PLAYED');
      this.loserSide.set(m.loserSide);
      const need = Math.ceil(m.event.bestOf / 2);
      this.rows.set(
        m.sets.length
          ? m.sets.map((s) => ({ side1: s.side1Games, side2: s.side2Games, tiebreak1: s.tiebreak1, tiebreak2: s.tiebreak2, superTiebreak: s.isSuperTiebreak }))
          : Array.from({ length: need }, emptyRow),
      );
      this.reason.set('');
      this.error.set(null);
      this.serverIssues.set([]);
    });
  }

  /** The deciding set of a match-tiebreak event starts as a match tiebreak. */
  protected addSet() {
    const m = this.match();
    const decider = this.rows().length + 1 === m.event.bestOf && m.event.finalSet === 'SUPER_TIEBREAK';
    this.rows.update((rows) => [...rows, { ...emptyRow(), superTiebreak: decider }]);
  }

  protected needsTiebreak(row: SetRow) {
    const g = this.match().event.gamesPerSet;
    const hi = Math.max(row.side1 ?? 0, row.side2 ?? 0);
    const lo = Math.min(row.side1 ?? 0, row.side2 ?? 0);
    return hi === g + 1 && lo === g;
  }

  protected patch(index: number, key: keyof SetRow, value: number | boolean | null) {
    this.serverIssues.set([]);
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  protected errorText(e: ScoreError) {
    const text = this.t(`matches.score.errors.${e.code}`);
    return e.set ? this.t('matches.score.setError', { n: e.set, error: text }) : text;
  }

  protected async submit() {
    const m = this.match();
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.api.enterResult(m.id, {
        outcome: this.outcome(),
        sets: this.scores(),
        loserSide: this.outcome() === 'PLAYED' ? undefined : (this.loserSide() ?? undefined),
        reason: this.reason().trim() || undefined,
        version: m.version,
      });
      this.saved.emit(saved);
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.code === 'SCORE_INVALID') this.serverIssues.set(error.issues as ScoreError[]);
      this.error.set(describeError(error, this.t));
    } finally {
      this.saving.set(false);
    }
  }
}
