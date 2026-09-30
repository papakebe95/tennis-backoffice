import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { InsightsApi } from './insights.api';

const POLL_MS = 60_000;

/** Unread notification count for the top bar, refreshed every minute. */
@Injectable({ providedIn: 'root' })
export class NotificationCenter {
  private readonly api = inject(InsightsApi);
  readonly unread = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Starts polling for the lifetime of the calling component. */
  watch(destroyRef: DestroyRef) {
    this.refresh();
    this.timer ??= setInterval(() => this.refresh(), POLL_MS);
    destroyRef.onDestroy(() => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    });
  }

  refresh() {
    this.api
      .unreadCount()
      .then((r) => this.unread.set(r.count))
      .catch(() => undefined);
  }
}
