import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../../core/api/api';
import { ImageUpload } from '../../shared/forms/image-upload';
import { SessionStore } from '../../core/auth/session.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChangePasswordForm } from '../../shared/forms/change-password-form';
import { TbDatePipe } from '../../shared/format';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'tb-profile-page',
  imports: [ImageUpload, PageHeader, StatusBadge, ChangePasswordForm, TbDatePipe],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly session = inject(SessionStore);
  protected readonly t = inject(I18nService).t;
  private readonly toasts = inject(MessageService);

  private readonly http = inject(HttpClient);

  /** The avatar is the player profile's, shared with the app. */
  protected async setAvatar(avatarUrl: string | null) {
    try {
      await firstValueFrom(this.http.patch(apiUrl('/users/me'), { avatarUrl }));
      await this.session.loadProfile();
      this.toasts.add({ severity: 'success', summary: this.t('profile.avatarSaved') });
    } catch {
      // The error interceptor already showed it.
    }
  }

  protected onChanged() {
    this.toasts.add({ severity: 'success', summary: this.t('profile.changePassword'), detail: this.t('profile.changed') });
  }
}
