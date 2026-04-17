/**
 * Article and related DTO types — mirrors the RealWorld API response shape.
 *
 * Source: apps/articles/models.py (BR-031 field mapping):
 *   model.summary  → API "description"
 *   model.content  → API "body"
 */

export interface ArticleAuthor {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface Article {
  slug: string;
  title: string;
  description: string;   // BR-031: maps to model.summary
  body: string;           // BR-031: maps to model.content
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number; // BR-025: real-time COUNT from DB
  author: ArticleAuthor;
}

export interface ArticlesResponse {
  articles: Article[];
  articlesCount: number;
}

export interface ArticleResponse {
  article: Article;
}

// ─── Request DTOs ───────────────────────────────────────────────────────────

export interface CreateArticleRequest {
  article: {
    title: string;
    description?: string;
    body?: string;
    tagList?: string[];
  };
}

export interface UpdateArticleRequest {
  article: {
    // BR-023: slug MUST NOT be included — server rejects it with 422.
    title?: string;
    description?: string;
    body?: string;
    tagList?: string[];
  };
}
