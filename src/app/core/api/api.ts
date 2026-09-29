import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Absolute URL of an API path ("/auth/me" → "/api/auth/me"). */
export const apiUrl = (path: string) => `${environment.apiUrl}${path}`;

export const isApiRequest = (url: string) => url.startsWith(environment.apiUrl);

/** Set on a request to handle its errors in place instead of with a toast. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Paginated list envelope used by every /admin list endpoint. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * An API failure in a shape the UI can use: HTTP status, the API's machine
 * code when it sent one (ACCOUNT_PENDING, SCHEDULE_CONFLICT…), and its
 * already-localized messages, plus the structured lists some codes carry
 * (`issues` of NOT_ELIGIBLE / TABLES_INVALID, `blockers` of
 * TRANSITION_BLOCKED). Stack traces never reach the browser: the API doesn't
 * send them, and nothing else is read from the body.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly messages: string[],
    readonly issues: unknown[] = [],
    readonly blockers: string[] = [],
  ) {
    super(messages[0] ?? `HTTP ${status}`);
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (!(error instanceof HttpErrorResponse)) return new ApiError(0, 'UNKNOWN', []);
    const body = (error.error ?? {}) as { code?: unknown; message?: unknown; issues?: unknown; blockers?: unknown; conflicts?: unknown };
    const messages = Array.isArray(body.message)
      ? body.message.filter((m): m is string => typeof m === 'string')
      : typeof body.message === 'string'
        ? [body.message]
        : [];
    return new ApiError(
      error.status,
      typeof body.code === 'string' ? body.code : null,
      messages,
      // `conflicts` of SCHEDULE_CONFLICT travel as issues too.
      Array.isArray(body.issues) ? body.issues : Array.isArray(body.conflicts) ? body.conflicts : [],
      Array.isArray(body.blockers) ? body.blockers.filter((b): b is string => typeof b === 'string') : [],
    );
  }
}
