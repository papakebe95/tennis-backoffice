import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

/** Search box that emits after the user pauses typing. */
@Component({
  selector: 'tb-search-input',
  imports: [IconFieldModule, InputIconModule, InputTextModule],
  template: `
    <p-iconfield>
      <p-inputicon class="pi pi-search" />
      <input
        pInputText
        type="search"
        [value]="text()"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        (input)="onInput($any($event.target).value)"
      />
    </p-iconfield>
  `,
  styles: `
    :host { display: block; min-width: min(100%, 260px); }
    input { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInput {
  readonly value = input<string | undefined>('');
  readonly placeholder = input('');
  readonly search = output<string>();

  protected readonly text = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Follow the URL (back button, "clear filters").
    effect(() => this.text.set(this.value() ?? ''));
  }

  protected onInput(value: string) {
    this.text.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.emit(value.trim()), 300);
  }
}
