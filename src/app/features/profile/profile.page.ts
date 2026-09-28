import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { SessionStore } from '../../core/auth/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChangePasswordForm } from '../../shared/forms/change-password-form';
import { TbDatePipe } from '../../shared/format';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'tb-profile-page',
  imports: [PageHeader, StatusBadge, ChangePasswordForm, TbDatePipe],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly session = inject(SessionStore);
  protected readonly t = inject(I18nService).t;
  private readonly toasts = inject(MessageService);

  protected onChanged() {
    this.toasts.add({ severity: 'success', summary: this.t('profile.changePassword'), detail: this.t('profile.changed') });
  }
}
