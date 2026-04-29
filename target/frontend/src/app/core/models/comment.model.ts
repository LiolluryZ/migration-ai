/**
 * Comment model interfaces.
 * Source: apps/comments/models.py — Comment (content, author, article, created, updated)
 * BR-039: body (content) is required and non-empty.
 * BR-043: comments ordered anti-chronologically by the backend.
 */

export interface CommentAuthor {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface Comment {
  id: number;
  createdAt: string;
  updatedAt: string;
  /** Maps to Comment.content in the Django model (BR-039). */
  body: string;
  author: CommentAuthor;
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface CommentResponse {
  comment: Comment;
}
