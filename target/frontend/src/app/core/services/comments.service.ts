import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Comment, CommentsResponse, CommentResponse } from '../models/comment.model';

export type { Comment };

/**
 * CommentsService — API client for the comments domain.
 *
 * Source: apps/comments/views.py (comment_create_view, comment_delete_view)
 *         apps/comments/urls.py
 *
 * BR-039: body required + non-empty (enforced server-side; validated in component).
 * BR-040: addComment requires auth (interceptor attaches Bearer token).
 * BR-041: deleteComment requires auth; server enforces double-auth (comment author OR article author).
 * BR-043: getComments returns comments ordered most-recent-first (server-side ORDER BY).
 */
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}`;

  /**
   * GET /api/articles/:slug/comments
   * RBAC: public
   * BR-043: server returns comments anti-chronologically.
   */
  getComments(slug: string): Observable<CommentsResponse> {
    return this.http.get<CommentsResponse>(`${this.base}/articles/${slug}/comments`);
  }

  /**
   * POST /api/articles/:slug/comments
   * RBAC: authenticated (BR-040)
   * BR-039: body must be non-empty.
   */
  addComment(slug: string, body: string): Observable<CommentResponse> {
    return this.http.post<CommentResponse>(`${this.base}/articles/${slug}/comments`, {
      comment: { body },
    });
  }

  /**
   * DELETE /api/articles/:slug/comments/:id
   * RBAC: authenticated — comment author OR article author (BR-041)
   */
  deleteComment(slug: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/articles/${slug}/comments/${id}`);
  }
}
