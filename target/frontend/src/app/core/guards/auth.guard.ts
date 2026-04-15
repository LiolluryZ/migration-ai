import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * AuthGuard — equivalent of Django @login_required decorator.
 *
 * Source: config/settings.py :: LOGIN_URL = "/login" (BR-005)
 * BR-005: IF NOT authenticated AND route.requires_auth THEN redirect('/login')
 *
 * Django redirected to /login with `next` query param.
 * REST/SPA equivalent: Angular redirects to /login with the same param so
 * the login page can return the user to their original destination.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // BR-005: redirect to /login, preserve intended URL as `next` param.
  return router.createUrlTree(['/login'], {
    queryParams: { next: state.url },
  });
};
