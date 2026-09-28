import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title block with an optional subtitle and right-aligned actions. */
@Component({
  selector: 'tb-page-header',
  template: `
    <div class="header">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--tb-space-4);
      margin-bottom: var(--tb-space-8);
    }
    h1 {
      font-size: var(--tb-text-2xl);
    }
    p {
      margin: var(--tb-space-1) 0 0;
      color: var(--tb-text-muted);
    }
    .actions {
      display: flex;
      gap: var(--tb-space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
