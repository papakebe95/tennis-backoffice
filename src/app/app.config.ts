import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { SessionStore } from './core/auth/session.store';
import { authInterceptor, errorInterceptor, langInterceptor } from './core/http/interceptors';
import { TennisPreset } from './core/theme/preset';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Outermost first: errors are reported after the auth retry had its go.
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, langInterceptor, authInterceptor])),
    providePrimeNG({
      theme: { preset: TennisPreset, options: { darkModeSelector: '.tb-dark' } },
      ripple: false,
      license: environment.primeLicense,
    }),
    MessageService,
    // Resume the session from the refresh cookie before the first route.
    provideAppInitializer(() => inject(SessionStore).restore()),
  ],
};
