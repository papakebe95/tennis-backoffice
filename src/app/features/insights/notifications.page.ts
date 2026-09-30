import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { I18nService } from '../../core/i18n/i18n.service';
import { TbAgoPipe } from '../../shared/format';
import { EmptyState } from '../../shared/ui/bits';
import { PageHeader } from '../../shared/ui/page-header';
import { NotificationCenter } from './notification-center';
import { InsightsApi } from './insights.api';
import type { AppNotification } from './insights.models';

const ICONS: Record<AppNotification['type'], string> = {
  BOOKING: 'pi pi-calendar',
  TOURNAMENT: 'pi pi-trophy',
  MATCH: 'pi pi-stopwatch',
  MARKETPLACE: 'pi pi-shopping-bag',
  SYSTEM: 'pi pi-info-circle',
};

/**
 * Where a notification leads in the back-office. Tournament routes are the
 * same as in the player app; others have no back-office page.
 */
export const backOfficeRoute = (n: AppNotification) => {
  const route = n.data?.route;
  return route && /^\/tournaments\/[\w-]+$/.test(route) ? route : null;
};

/** /notifications — the signed-in user's notifications, in their language. */
@Component({
  selector: 'tb-notifications-page',
  imports: [ButtonModule, SkeletonModule, EmptyState, PageHeader, TbAgoPipe],
  template: `
    <tb-page-header [title]="t('inbox.title')" [subtitle]="t('inbox.subtitle')">
      @if (list.value()?.unreadCount) {
        <p-button [label]="t('inbox.markAll')" icon="pi pi-check-square" severity="secondary" [outlined]="true" (onClick)="markAll()" />
      }
    </tb-page-header>
    <div class="tb-card list">
      @if (list.value(); as l) {
        @for (n of l.items; track n.id) {
          <button type="button" class="item" [class.unread]="!n.read" (click)="open(n)">
            <i [class]="icon(n)" aria-hidden="true"></i>
            <span class="text">
              <strong>{{ n.title }}</strong>
              <span>{{ n.body }}</span>
            </span>
            <small class="tb-muted">{{ n.createdAt | tbAgo }}</small>
          </button>
        } @empty {
          <tb-empty-state [message]="t('inbox.empty')" icon="pi pi-bell" />
        }
      } @else {
        <p-skeleton height="240px" />
      }
    </div>
  `,
  styles: `
    .list { padding: 0; overflow: hidden; }
    .item { all: unset; box-sizing: border-box; width: 100%; display: flex; gap: var(--tb-space-3); align-items: flex-start; padding: var(--tb-space-4) var(--tb-space-5); border-bottom: 1px solid var(--tb-border); cursor: pointer; }
    .item:last-child { border-bottom: 0; }
    .item:hover, .item:focus-visible { background: var(--tb-surface-muted); }
    .item i { margin-top: 3px; color: var(--tb-primary-600); }
    .item.unread { background: var(--tb-primary-50); }
    .item.unread strong::after { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--tb-primary-600); margin-left: 8px; vertical-align: middle; }
    .text { flex: 1; display: grid; gap: 2px; }
    .text span { color: var(--tb-text-muted); font-size: var(--tb-text-sm); }
    small { white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  protected readonly t = inject(I18nService).t;
  private readonly api = inject(InsightsApi);
  private readonly router = inject(Router);
  private readonly center = inject(NotificationCenter);

  protected readonly list = resource({ loader: () => this.api.notifications() });

  protected icon(n: AppNotification) {
    return ICONS[n.type] ?? ICONS.SYSTEM;
  }

  protected async open(n: AppNotification) {
    if (!n.read) {
      await this.api.markRead(n.id).catch(() => undefined);
      this.list.reload();
      this.center.refresh();
    }
    const route = backOfficeRoute(n);
    if (route) void this.router.navigateByUrl(route);
  }

  protected async markAll() {
    await this.api.markAllRead();
    this.list.reload();
    this.center.refresh();
  }
}
