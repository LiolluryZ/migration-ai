import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  Article,
  ArticlesResponse,
  ArticleResponse,
  CreateArticleRequest,
  UpdateArticleRequest,
} from '../models/article.model';

// ArticlesService — replaces apps/articles/views.py HTTP interactions.
//
// Source:
//   apps/articles/views.py :: home_view, tag_view, article_detail_view,
//   article_create_view, article_edit_view, article_delete_view,
//   article_favorite_view
//
// BR-028: pagination via ?page= query param (ARTICLES_PER_PAGE=10).
// BR-023: updateArticle NEVER sends a 'slug' field (BR-023 enforcement).

// Local constant mirrors apps/articles/views.py :: ARTICLES_PER_PAGE = 10
export const ARTICLES_PER_PAGE = 10;

@Injectable({ providedIn: 'root' })
export class ArticlesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/articles`;

  /**
   * GET /api/articles
   * Source: apps/articles/views.py :: home_view / _build_feed
   * Supports: feed=following, tag=xxx, author=xxx, favorited=xxx, page=N
   */
  getArticles(params: {
    feed?: 'following' | 'global';
    tag?: string;
    author?: string;
    favorited?: string;
    page?: number;
  } = {}): Observable<ArticlesResponse> {
    let httpParams = new HttpParams();
    if (params.feed === 'following') httpParams = httpParams.set('feed', 'following');
    if (params.tag) httpParams = httpParams.set('tag', params.tag);
    if (params.author) httpParams = httpParams.set('author', params.author);
    if (params.favorited) httpParams = httpParams.set('favorited', params.favorited);
    if (params.page && params.page > 1) httpParams = httpParams.set('page', String(params.page));

    return this.http.get<ArticlesResponse>(this.base, { params: httpParams });
  }

  /**
   * GET /api/articles/:slug
   * Source: apps/articles/views.py :: article_detail_view
   */
  getArticle(slug: string): Observable<ArticleResponse> {
    return this.http.get<ArticleResponse>(`${this.base}/${slug}`);
  }

  /**
   * POST /api/articles
   * Source: apps/articles/views.py :: article_create_view
   * BR-033: auth required (handled by auth interceptor)
   */
  createArticle(data: CreateArticleRequest): Observable<ArticleResponse> {
    return this.http.post<ArticleResponse>(this.base, data);
  }

  /**
   * PATCH /api/articles/:slug
   * Source: apps/articles/views.py :: article_edit_view
   * BR-023: NEVER include 'slug' in the request body (server enforces this).
   * BR-034: non-owner → 404 (server returns 404 for non-owner, not 403).
   */
  updateArticle(slug: string, data: UpdateArticleRequest): Observable<ArticleResponse> {
    // Safety: strip 'slug' from the request body (BR-023)
    const safeData = { article: { ...data.article } } as UpdateArticleRequest & { article: { slug?: never } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (safeData.article as any)['slug'];
    return this.http.patch<ArticleResponse>(`${this.base}/${slug}`, safeData);
  }

  /**
   * DELETE /api/articles/:slug
   * Source: apps/articles/views.py :: article_delete_view
   */
  deleteArticle(slug: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${slug}`);
  }

  /**
   * POST /api/articles/:slug/favorite
   * Source: apps/articles/views.py :: article_favorite_view (toggle, favorites.add)
   * BR-036: toggle — this method adds. Call unfavoriteArticle to remove.
   */
  favoriteArticle(slug: string): Observable<ArticleResponse> {
    return this.http.post<ArticleResponse>(`${this.base}/${slug}/favorite`, {});
  }

  /**
   * DELETE /api/articles/:slug/favorite
   * Source: apps/articles/views.py :: article_favorite_view (toggle, favorites.remove)
   */
  unfavoriteArticle(slug: string): Observable<ArticleResponse> {
    return this.http.delete<ArticleResponse>(`${this.base}/${slug}/favorite`);
  }

  /** Returns all tags by fetching articles and extracting unique tagList entries. */
  getTags(): Observable<{ tags: string[] }> {
    return this.http.get<{ tags: string[] }>(`${environment.apiUrl}/tags`);
  }
}
