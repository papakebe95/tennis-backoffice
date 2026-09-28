import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../api/api';
import { AuthApi } from './auth.api';
import type { AccessProfile } from './auth.models';

/**
 * The signed-in session. The access token lives only in memory; on reload the
 * session is restored from the httpOnly refresh cookie (restore()).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);

  readonly accessToken = signal<string | null>(null);
  readonly profile = signal<AccessProfile | null>(null);

  readonly user = computed(() => this.profile()?.user ?? null);
  readonly isAuthenticated = computed(() => this.profile() !== null);
  readonly isPending = computed(() => this.user()?.status === 'PENDING');
  readonly mustChangePassword = computed(() => this.user()?.mustChangePassword === true);

  private refreshing: Promise<string | null> | null = null;
  private lastRefreshError: ApiError | null = null;

  /** App start: resume a session from the refresh cookie, if there is one. */
  async restore(): Promise<void> {
    const token = await this.refreshAccessToken();
    if (!token) return;
    try {
      await this.loadProfile();
    } catch {
      this.clear();
    }
  }

  async login(identifier: string, password: string): Promise<void> {
    const { accessToken } = await this.api.login(identifier, password);
    await this.start(accessToken);
  }

  /** Begins a session from a fresh access token (login, sign-up). */
  async start(accessToken: string): Promise<void> {
    this.accessToken.set(accessToken);
    await this.loadProfile();
  }

  /** Where a freshly signed-in user belongs. */
  homeUrl(): string {
    if (this.user()?.mustChangePassword) return '/change-password';
    return this.isPending() ? '/pending' : '/dashboard';
  }

  async loadProfile(): Promise<void> {
    this.profile.set(await this.api.me());
  }

  /**
   * Gets a new access token. Concurrent callers share one request, and tabs
   * take turns through a Web Lock: refresh tokens rotate, so two tabs
   * presenting the same cookie at once would sign one of them out.
   */
  refreshAccessToken(): Promise<string | null> {
    this.refreshing ??= withCrossTabLock(() => this.api.refresh())
      .then(({ accessToken }) => {
        this.lastRefreshError = null;
        this.accessToken.set(accessToken);
        return accessToken;
      })
      .catch((error: unknown) => {
        this.lastRefreshError = ApiError.from(error);
        this.accessToken.set(null);
        return null;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const { accessToken } = await this.api.changePassword(currentPassword, newPassword);
    this.accessToken.set(accessToken);
    await this.loadProfile();
  }

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } catch {
      // Already signed out server-side: nothing else to do.
    }
    this.clear();
    await this.router.navigate(['/login'], { queryParams: { reason: 'signedOut' } });
  }

  /** The session can't continue (refresh failed): back to the login page. */
  expire(): void {
    const code = this.lastRefreshError?.code;
    this.clear();
    void this.router.navigate(['/login'], {
      queryParams: { reason: code ?? 'sessionExpired' },
    });
  }

  private clear() {
    this.accessToken.set(null);
    this.profile.set(null);
  }
}

function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request('tb-auth-refresh', task) : task();
}
