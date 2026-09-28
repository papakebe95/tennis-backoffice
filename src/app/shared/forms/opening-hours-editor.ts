import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { WEEKDAYS, type Weekday, type WeeklyHours } from '../../features/organizations/org.models';

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Same rules as the API: HH:mm, closing after opening, no overlap in a day. */
export function dayValid(ranges: string[]): boolean {
  const windows = ranges.map((r) => r.split('-'));
  if (windows.some(([a, b]) => !/^\d{2}:\d{2}$/.test(a ?? '') || !/^\d{2}:\d{2}$/.test(b ?? '') || toMinutes(a) >= toMinutes(b))) {
    return false;
  }
  const sorted = [...windows].sort((x, y) => toMinutes(x[0]) - toMinutes(y[0]));
  return sorted.every((w, i) => i === 0 || toMinutes(w[0]) >= toMinutes(sorted[i - 1][1]));
}

export const hoursValid = (week: WeeklyHours) => WEEKDAYS.every((day) => dayValid(week[day] ?? []));

export const emptyWeek = (): WeeklyHours =>
  Object.fromEntries(WEEKDAYS.map((day) => [day, [] as string[]])) as unknown as WeeklyHours;

/**
 * Weekly opening hours: per day, closed or one or more windows. Emits a new
 * value on every change (the parent owns the state).
 */
@Component({
  selector: 'tb-opening-hours-editor',
  imports: [FormsModule, ButtonModule, ToggleSwitchModule],
  template: `
    <div class="week" role="group">
      @for (day of days; track day) {
        <div class="day" [class.invalid]="!valid()[day]">
          <label class="day-name">
            <p-toggleswitch [ngModel]="(value()[day] ?? []).length > 0" (ngModelChange)="toggleDay(day, $event)" [disabled]="disabled()" />
            <span>{{ t('hours.days.' + day) }}</span>
          </label>
          <div class="windows">
            @for (range of value()[day] ?? []; track $index) {
              <div class="window">
                <input type="time" [value]="part(range, 0)" (change)="setTime(day, $index, 0, $any($event.target).value)" [disabled]="disabled()" [attr.aria-label]="t('hours.days.' + day) + ' ' + t('hours.open')" />
                <span aria-hidden="true">–</span>
                <input type="time" [value]="part(range, 1)" (change)="setTime(day, $index, 1, $any($event.target).value)" [disabled]="disabled()" [attr.aria-label]="t('hours.days.' + day) + ' ' + t('hours.closed')" />
                @if (!disabled()) {
                  <p-button icon="pi pi-times" [text]="true" severity="secondary" size="small" [ariaLabel]="t('hours.remove')" (onClick)="removeWindow(day, $index)" />
                }
              </div>
            } @empty {
              <span class="closed">{{ t('hours.closed') }}</span>
            }
            @if (!disabled() && (value()[day] ?? []).length > 0) {
              <p-button [label]="t('hours.addWindow')" icon="pi pi-plus" [text]="true" size="small" (onClick)="addWindow(day)" />
            }
          </div>
          @if (!disabled() && day === 'mon') {
            <p-button class="copy" [label]="t('hours.copyToAll')" icon="pi pi-copy" [text]="true" size="small" severity="secondary" (onClick)="copyToAll()" />
          }
        </div>
      }
    </div>
    @if (!allValid()) {
      <p class="tb-field-error">{{ t('hours.invalid') }}</p>
    }
  `,
  styles: `
    .week { display: grid; gap: var(--tb-space-2); }
    .day { display: grid; grid-template-columns: 170px 1fr auto; align-items: start; gap: var(--tb-space-3); padding: var(--tb-space-2) 0; border-top: 1px solid var(--tb-border); }
    .day:first-child { border-top: 0; }
    .day.invalid .window input { border-color: var(--tb-tone-danger-fg); }
    .day-name { display: flex; align-items: center; gap: var(--tb-space-3); font-weight: var(--tb-weight-medium); min-height: 36px; }
    .windows { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tb-space-2) var(--tb-space-4); min-height: 36px; }
    .window { display: flex; align-items: center; gap: var(--tb-space-2); }
    input[type='time'] { font: inherit; padding: 6px 8px; border: 1px solid var(--tb-border-strong); border-radius: var(--tb-radius-sm); background: var(--tb-surface); color: var(--tb-text); }
    .closed { color: var(--tb-text-subtle); }
    @media (max-width: 700px) { .day { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningHoursEditor {
  protected readonly t = inject(I18nService).t;
  readonly value = input.required<WeeklyHours>();
  readonly disabled = input(false);
  readonly valueChange = output<WeeklyHours>();

  protected readonly days = WEEKDAYS;
  protected readonly valid = computed(() =>
    Object.fromEntries(WEEKDAYS.map((day) => [day, dayValid(this.value()[day] ?? [])])) as Record<Weekday, boolean>,
  );
  protected readonly allValid = computed(() => Object.values(this.valid()).every(Boolean));

  protected part(range: string, index: 0 | 1) {
    return range.split('-')[index] ?? '';
  }

  protected toggleDay(day: Weekday, open: boolean) {
    this.emit(day, open ? ['08:00-22:00'] : []);
  }

  protected addWindow(day: Weekday) {
    const ranges = this.value()[day] ?? [];
    const lastClose = ranges.length ? this.part(ranges[ranges.length - 1], 1) : '08:00';
    const start = Math.min(toMinutes(lastClose) + 60, 22 * 60);
    const pad = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    this.emit(day, [...ranges, `${pad(start)}-${pad(Math.min(start + 120, 23 * 60 + 59))}`]);
  }

  protected removeWindow(day: Weekday, index: number) {
    this.emit(day, (this.value()[day] ?? []).filter((_, i) => i !== index));
  }

  protected setTime(day: Weekday, index: number, part: 0 | 1, time: string) {
    const ranges = [...(this.value()[day] ?? [])];
    const pieces = ranges[index].split('-');
    pieces[part] = time;
    ranges[index] = pieces.join('-');
    this.emit(day, ranges);
  }

  protected copyToAll() {
    const monday = this.value().mon ?? [];
    this.valueChange.emit(Object.fromEntries(WEEKDAYS.map((day) => [day, [...monday]])) as unknown as WeeklyHours);
  }

  private emit(day: Weekday, ranges: string[]) {
    this.valueChange.emit({ ...this.value(), [day]: ranges });
  }
}
