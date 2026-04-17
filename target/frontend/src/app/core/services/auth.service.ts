import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

/** Shape returned by POST /api/users/login, POST /api/users, GET/PUT /api/user */
interface UserApiResponse {
  user: User & { token: string };
}

/** PUT /api/user payload */
export interface UpdateUserPayload {
  email?: string;
  username?: string;
  bio?: string;
  image?: string | null;
  password?: string;
}

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
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}`;

  // Reactive state — equivalent to conduit_authenticated + conduit_user_json
  private readonly _currentUser = signal<User | null>(null);

  /** Emits the logged-in user, or null when unauthenticated. */
  readonly currentUser = this._currentUser.asReadonly();

  /** True when a user is authenticated — equivalent to conduit_authenticated. */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  private readonly TOKEN_KEY = 'conduit_token';
  private readonly USER_KEY = 'conduit_user';

  constructor() {
    // Restore session from localStorage on app startup.
    // Equivalent to Django's session middleware reading the cookie on every request.
    this.restoreSession();
  }

  /**
   * POST /api/users/login
   * Source: accounts/views.py :: login_view (BR-011, BR-006)
   */
  login(email: string, password: string): Observable<UserApiResponse> {
    return this.http
      .post<UserApiResponse>(`${this.base}/users/login`, { user: { email, password } })
      .pipe(tap((res) => this._applyUserResponse(res)));
  }

  /**
   * POST /api/users
   * Source: accounts/views.py :: register_view (BR-013, BR-014)
   */
  register(username: string, email: string, password: string): Observable<UserApiResponse> {
    return this.http
      .post<UserApiResponse>(`${this.base}/users`, { user: { username, email, password } })
      .pipe(tap((res) => this._applyUserResponse(res)));
  }

  /**
   * GET /api/user
   * Source: accounts/views.py :: settings_view GET (BR-005)
   */
  getCurrentUser(): Observable<UserApiResponse> {
    return this.http
      .get<UserApiResponse>(`${this.base}/user`)
      .pipe(tap((res) => this._applyUserResponse(res)));
  }

  /**
   * PUT /api/user
   * Source: accounts/views.py :: settings_view POST (BR-015)
   */
  updateUser(payload: UpdateUserPayload): Observable<UserApiResponse> {
    return this.http
      .put<UserApiResponse>(`${this.base}/user`, { user: payload })
      .pipe(tap((res) => this._applyUserResponse(res)));
  }

  /** Persists the JWT and sets the current user signal. */
  setCurrentUser(user: User, token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
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
    localStorage.removeItem(this.USER_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/']);
  }

  /** Apply a user API response: persist token + update signal. */
  private _applyUserResponse(res: UserApiResponse): void {
    const { token, ...user } = res.user;
    this.setCurrentUser(user, token);
  }

  /** Attempts to reload the current user from the API if a token is stored. */
  private restoreSession(): void {
    const token = this.getToken();
    if (!token) return;

    // Step 1 — Restore user from localStorage immediately (synchronous).
    // This populates the signal before any HTTP request, so the header renders
    // correctly on first paint without waiting for the backend.
    const raw = localStorage.getItem(this.USER_KEY);
    if (raw) {
      try {
        this._currentUser.set(JSON.parse(raw) as User);
      } catch {
        // Corrupt data — ignore, API call will fix it below
      }
    }

    // Step 2 — Validate the token in background with GET /api/user.
    // If the token is expired (401), clear everything. Network errors are ignored
    // (user stays logged in; stale profile data is acceptable vs. false logout).
    this.getCurrentUser().subscribe({
      error: (err: { status?: number }) => {
        if (err?.status === 401) {
          localStorage.removeItem(this.TOKEN_KEY);
          localStorage.removeItem(this.USER_KEY);
          this._currentUser.set(null);
        }
      },
    });
  }
}
