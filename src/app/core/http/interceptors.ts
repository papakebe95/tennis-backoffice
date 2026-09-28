import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ApiError, isApiRequest, SILENT_ERRORS } from '../api/api';
import { SessionStore } from '../auth/session.store';
import { I18nService, type I18nKey } from '../i18n/i18n.service';

/** Sends the UI language so API messages come back in it. */
export const langInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);
  return next(req.clone({ setHeaders: { lang: inject(I18nService).lang() } }));
};

// Auth endpoints never trigger a refresh-and-retry (that would loop).
const NO_RETRY = ['/auth/login', '/auth/refresh-token', '/auth/logout'];

/**
 * Attaches the access token; on a 401, refreshes it once and replays the
 * request. If the refresh fails the session is over.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);
  const session = inject(SessionStore);
  const withToken = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(session.accessToken())).pipe(
    catchError((error: unknown) => {
      const retryable =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !NO_RETRY.some((path) => req.url.endsWith(path));
      if (!retryable) return throwError(() => error);

      return from(session.refreshAccessToken()).pipe(
        switchMap((token) => {
          if (!token) {
            session.expire();
            return throwError(() => error);
          }
          return next(withToken(token));
        }),
      );
    }),
  );
};

const STATUS_MESSAGES: Record<number, I18nKey> = {
  0: 'errors.network',
  400: 'errors.badRequest',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  422: 'errors.unprocessable',
  429: 'errors.tooManyRequests',
};

/** Human-readable text for an API error, preferring the API's own message. */
export function describeError(error: ApiError, t: I18nService['t']): string {
  if (error.status === 403) return t('errors.forbidden'); // never leak internals
  if (error.status >= 500) return t('errors.server');
  if (error.messages.length && error.status !== 0) return error.messages.join(' ');
  return t(STATUS_MESSAGES[error.status] ?? 'errors.server');
}

/**
 * Turns every API failure into an ApiError and, unless the request opted out
 * with SILENT_ERRORS, shows it as a toast. Runs outermost, so it only sees
 * what the auth retry couldn't fix.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);
  const toasts = inject(MessageService);
  const i18n = inject(I18nService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((raw: unknown) => {
      const error = ApiError.from(raw);
      if (error.code === 'ACCOUNT_PENDING') {
        void router.navigate(['/pending']);
      } else if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
        void router.navigate(['/change-password']);
      } else if (error.status !== 401 && !req.context.get(SILENT_ERRORS)) {
        toasts.add({
          severity: error.status >= 500 || error.status === 0 ? 'error' : 'warn',
          summary: i18n.t('errors.title'),
          detail: describeError(error, i18n.t),
        });
      }
      return throwError(() => error);
    }),
  );
};
