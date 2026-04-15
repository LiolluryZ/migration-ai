import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

// Source: config/settings.py :: INSTALLED_APPS + MIDDLEWARE (TM-001)
// Fastify plugins become Angular providers here.
// BR-006: locale set to en-US (default Angular locale matches LANGUAGE_CODE = 'en-us')
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // JWT interceptor: attaches Authorization: Bearer header on every API call.
    // Source: TM-auth, BR-005
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
