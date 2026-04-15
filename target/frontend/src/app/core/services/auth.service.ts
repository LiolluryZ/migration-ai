import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

/**
 * AuthService — Angular equivalent of helpers/context_processors.py::conduit_context.
 *
 * Source: helpers/context_processors.py (BR-003)
 * The Django context processor injects `conduit_user_json` and `conduit_authenticated`
 * into every server-rendered template.  In the Angular SPA, this is replaced by a
 * reactive signal-based service that any component can inject.
 *
 * JWT strategy (replaces Django session auth — BR-005, TM-auth):
 *   - Token stored in localStorage under 'conduit_token'
 *   - Restored on app startup (bootstrap)
 *   - Cleared on logout
 *
 * BR-003 edge case: bio and image are null when empty (not empty string).
 *   Preserved here — the currentUser signal stores null for both fields when absent.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Reactive state — equivalent to conduit_authenticated + conduit_user_json
  private readonly _currentUser = signal<User | null>(null);

  /** Emits the logged-in user, or null when unauthenticated. */
  readonly currentUser = this._currentUser.asReadonly();

  /** True when a user is authenticated — equivalent to conduit_authenticated. */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  private readonly TOKEN_KEY = 'conduit_token';

  constructor() {
    // Restore session from localStorage on app startup.
    // Equivalent to Django's session middleware reading the cookie on every request.
    this.restoreSession();
  }

  /** Persists the JWT and sets the current user signal. */
  setCurrentUser(user: User, token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this._currentUser.set(user);
  }

  /** Reads the stored JWT (for HTTP interceptors / Authorization header). */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Clears the session — equivalent to Django's auth.logout(request).
   * Source: accounts/views.py :: logout_view (WF-004)
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this._currentUser.set(null);
  }

  /** Attempts to reload the current user from the API if a token is stored. */
  private restoreSession(): void {
    const token = this.getToken();
    if (!token) return;

    // Will be wired to GET /api/auth/me in the accounts module (Sprint 3).
    // For now we bootstrap with the stored token; the accounts module will
    // add the /me endpoint and call it here.
  }
}
