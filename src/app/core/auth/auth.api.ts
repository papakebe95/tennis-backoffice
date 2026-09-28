import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, SILENT_ERRORS } from '../api/api';
import type { AccessProfile, AccessToken } from './auth.models';

// The refresh token lives in an httpOnly cookie the API sets when asked with
// this header; this app only ever holds the short-lived access token, in
// memory. The header also makes these calls CORS-preflighted (CSRF-safe).
const COOKIE_MODE = new HttpHeaders({ 'X-Auth-Mode': 'cookie' });
const silent = () => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(identifier: string, password: string) {
    return firstValueFrom(
      this.http.post<AccessToken>(
        apiUrl('/auth/login'),
        { identifier, password },
        { headers: COOKIE_MODE, withCredentials: true, context: silent() },
      ),
    );
  }

  refresh() {
    return firstValueFrom(
      this.http.post<AccessToken>(apiUrl('/auth/refresh-token'), {}, {
        headers: COOKIE_MODE,
        withCredentials: true,
        context: silent(),
      }),
    );
  }

  logout() {
    return firstValueFrom(
      this.http.post<void>(apiUrl('/auth/logout'), {}, {
        headers: COOKIE_MODE,
        withCredentials: true,
        context: silent(),
      }),
    );
  }

  me() {
    return firstValueFrom(this.http.get<AccessProfile>(apiUrl('/auth/me')));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return firstValueFrom(
      this.http.post<AccessToken>(
        apiUrl('/auth/change-password'),
        { currentPassword, newPassword },
        { headers: COOKIE_MODE, withCredentials: true, context: silent() },
      ),
    );
  }
}
