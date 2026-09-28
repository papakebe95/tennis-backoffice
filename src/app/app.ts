import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmHost } from './shared/ui/confirm';

@Component({
  selector: 'tb-root',
  imports: [RouterOutlet, ToastModule, ConfirmHost],
  template: `
    <p-toast position="top-right" />
    <tb-confirm-host />
    <router-outlet />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
