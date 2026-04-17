import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Profile shape returned by GET /api/profiles/:username,
 * POST/DELETE /api/profiles/:username/follow.
 *
 * Source: accounts/views.py :: _profile_view + follow_view
 * BR-010: following is asymmetric (A follows B ≠ B follows A).
 */
export interface Profile {
  username: string;
  bio: string;
  image: string | null;
  following: boolean;
}

export interface ProfileResponse {
  profile: Profile;
}

/**
 * ProfilesService — API calls for user profiles and follow/unfollow.
 *
 * Source: apps/accounts/urls.py ::
 *   path('profile/<str:username>', ...)        → GET /api/profiles/:username
 *   path('profile/<str:username>/follow', ...) → POST/DELETE /api/profiles/:username/follow
 */
@Injectable({ providedIn: 'root' })
export class ProfilesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/profiles`;

  /**
   * GET /api/profiles/:username
   * Source: accounts/views.py :: profile_view / _profile_view
   * 404 for unknown username.
   */
  getProfile(username: string): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.base}/${username}`);
  }

  /**
   * POST /api/profiles/:username/follow
   * Source: accounts/views.py :: follow_view (followers.add branch)
   * BR-010: idempotent — already-followed user → 200 OK.
   */
  follow(username: string): Observable<ProfileResponse> {
    return this.http.post<ProfileResponse>(`${this.base}/${username}/follow`, {});
  }

  /**
   * DELETE /api/profiles/:username/follow
   * Source: accounts/views.py :: follow_view (followers.remove branch)
   * BR-010: idempotent — not-followed user → 200 OK.
   */
  unfollow(username: string): Observable<ProfileResponse> {
    return this.http.delete<ProfileResponse>(`${this.base}/${username}/follow`);
  }
}
