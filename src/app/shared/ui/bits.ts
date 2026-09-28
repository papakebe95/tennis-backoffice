import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Friendly "nothing here" block for lists and panels. */
@Component({
  selector: 'tb-empty-state',
  template: `
    <div class="empty">
      <i [class]="icon()" aria-hidden="true"></i>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty { display: grid; justify-items: center; gap: var(--tb-space-3); padding: var(--tb-space-10) var(--tb-space-4); text-align: center; color: var(--tb-text-muted); }
    i { font-size: 1.75rem; color: var(--tb-text-subtle); }
    p { margin: 0; max-width: 360px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly message = input.required<string>();
  readonly icon = input('pi pi-inbox');
}

/** Headline figure with a label and an optional hint / link. */
@Component({
  selector: 'tb-kpi-card',
  imports: [RouterLink],
  template: `
    <article class="kpi">
      <div class="top">
        <span class="label">{{ label() }}</span>
        <span class="icon" aria-hidden="true"><i [class]="icon()"></i></span>
      </div>
      <strong class="value">{{ formatted() }}</strong>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
      @if (link()) {
        <a class="stretched" [routerLink]="link()" [attr.aria-label]="label()"></a>
      }
    </article>
  `,
  styles: `
    .kpi { position: relative; display: flex; flex-direction: column; gap: var(--tb-space-1); padding: var(--tb-space-5); background: var(--tb-surface); border: 1px solid var(--tb-border); border-radius: var(--tb-radius-lg); box-shadow: var(--tb-shadow-sm); }
    .kpi:has(.stretched):hover { border-color: var(--tb-primary-300); }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .label { color: var(--tb-text-muted); font-weight: var(--tb-weight-medium); }
    .icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--tb-radius-md); background: var(--tb-primary-50); color: var(--tb-primary-700); }
    .value { font-size: var(--tb-text-3xl); font-weight: var(--tb-weight-semibold); letter-spacing: -0.02em; }
    .hint { color: var(--tb-text-subtle); font-size: var(--tb-text-sm); }
    .stretched { position: absolute; inset: 0; border-radius: inherit; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly hint = input<string>();
  readonly icon = input('pi pi-chart-line');
  readonly link = input<string>();
  protected readonly formatted = computed(() => new Intl.NumberFormat().format(this.value()));
}

/** Avatar initials + name + secondary line, used in tables and headers. */
@Component({
  selector: 'tb-user-cell',
  template: `
    <span class="avatar" [class.lg]="size() === 'lg'" aria-hidden="true">{{ initials() }}</span>
    <span class="text">
      <strong>{{ firstname() }} {{ lastname() }}</strong>
      @if (secondary()) {
        <small>{{ secondary() }}</small>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--tb-space-3); min-width: 0; }
    .avatar { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--tb-primary-100); color: var(--tb-primary-800); font-weight: var(--tb-weight-semibold); font-size: var(--tb-text-sm); }
    .avatar.lg { width: 56px; height: 56px; font-size: var(--tb-text-lg); }
    .text { display: flex; flex-direction: column; min-width: 0; }
    strong { font-weight: var(--tb-weight-semibold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    small { color: var(--tb-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCell {
  readonly firstname = input.required<string>();
  readonly lastname = input.required<string>();
  readonly secondary = input<string | null>();
  readonly size = input<'md' | 'lg'>('md');
  protected readonly initials = computed(() => `${this.firstname()[0] ?? ''}${this.lastname()[0] ?? ''}`.toUpperCase());
}
