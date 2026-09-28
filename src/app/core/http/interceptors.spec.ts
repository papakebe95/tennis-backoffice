import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api';
import { SessionStore } from '../auth/session.store';
import { authInterceptor, describeError, errorInterceptor, langInterceptor } from './interceptors';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionStore;
  let toasts: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, langInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    toasts = TestBed.inject(MessageService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('sends the bearer token and the UI language to the API only', () => {
    session.accessToken.set('t1');
    void firstValueFrom(http.get('/api/users'));
    const req = backend.expectOne('/api/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer t1');
    expect(req.request.headers.get('lang')).toBe('fr');

    void firstValueFrom(http.get('https://cdn.example.com/x'));
    expect(backend.expectOne('https://cdn.example.com/x').request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes once on 401 and replays the request with the new token', async () => {
    session.accessToken.set('old');
    const refresh = vi.spyOn(session, 'refreshAccessToken').mockImplementation(async () => {
      session.accessToken.set('new');
      return 'new';
    });
    const result = firstValueFrom(http.get<{ ok: boolean }>('/api/users'));

    backend.expectOne('/api/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    const retried = backend.expectOne('/api/users');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new');
    retried.flush({ ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the refresh fails', async () => {
    vi.spyOn(session, 'refreshAccessToken').mockResolvedValue(null);
    const expire = vi.spyOn(session, 'expire').mockImplementation(() => undefined);
    const result = firstValueFrom(http.get('/api/users'));
    backend.expectOne('/api/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    expect(expire).toHaveBeenCalled();
  });

  it('never tries to refresh on the auth endpoints themselves', async () => {
    const refresh = vi.spyOn(session, 'refreshAccessToken');
    const result = firstValueFrom(http.post('/api/auth/login', {}));
    backend.expectOne('/api/auth/login').flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('turns failures into ApiError and toasts a readable message', async () => {
    const add = vi.spyOn(toasts, 'add');
    const result = firstValueFrom(http.get('/api/courts/1'));
    backend.expectOne('/api/courts/1').flush(
      { statusCode: 403, message: 'internal detail', code: 'FORBIDDEN' },
      { status: 403, statusText: 'Forbidden' },
    );
    await expect(result).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(add.mock.calls[0][0].detail).toBe('Vous n’avez pas la permission d’effectuer cette action.');
  });
});

describe('describeError', () => {
  const t = (key: string) => key;

  it('prefers the API message for client errors', () => {
    expect(describeError(new ApiError(409, 'SCHEDULE_CONFLICT', ['Court already used']), t)).toBe('Court already used');
  });

  it('never shows server internals', () => {
    expect(describeError(new ApiError(500, null, ['TypeError at line 3']), t)).toBe('errors.server');
    expect(describeError(new ApiError(0, null, []), t)).toBe('errors.network');
  });

  it('maps a raw HttpErrorResponse', () => {
    const error = ApiError.from(
      new HttpErrorResponse({ status: 400, error: { message: ['a is invalid', 'b is invalid'] } }),
    );
    expect(error.messages).toEqual(['a is invalid', 'b is invalid']);
    expect(describeError(error, t)).toBe('a is invalid b is invalid');
  });
});
