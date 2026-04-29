import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommentsService } from '../../../core/services/comments.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Comment } from '../../../core/models/comment.model';

/**
 * CommentListComponent — translated from templates/partials/comment_list.html
 *                        and apps/comments/views.py.
 *
 * Source: apps/comments/views.py :: comment_create_view + comment_delete_view
 *         templates/partials/comment_list.html
 *
 * BR-039: body non-empty enforced before submit.
 * BR-040: form only shown to authenticated users.
 * BR-041: delete button shown to comment author OR article author; server enforces.
 * BR-043: comments ordered most-recent-first (server-side).
 */
@Component({
  selector: 'app-comment-list',
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './comment-list.html',
  styleUrl: './comment-list.scss',
})
export class CommentListComponent implements OnInit {
  /** Slug of the article whose comments to display. */
  @Input({ required: true }) slug!: string;
  /** Username of the article author — used for BR-041 delete display logic. */
  @Input({ required: true }) articleAuthorUsername!: string;

  protected readonly auth = inject(AuthService);
  private readonly commentsService = inject(CommentsService);

  protected readonly comments = signal<Comment[]>([]);
  protected readonly loadingComments = signal(true);
  protected readonly newBody = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  ngOnInit(): void {
    this.commentsService.getComments(this.slug).subscribe({
      next: (res) => {
        this.comments.set(res.comments);
        this.loadingComments.set(false);
      },
      error: () => this.loadingComments.set(false),
    });
  }

  /**
   * Returns true if the current user can delete the given comment.
   * BR-041: comment author OR article author may delete.
   */
  canDelete(comment: Comment): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    return (
      user.username === comment.author.username ||
      user.username === this.articleAuthorUsername
    );
  }

  submitComment(): void {
    const body = this.newBody().trim();
    if (!body || this.submitting()) return; // BR-039: non-empty
    this.submitting.set(true);
    this.submitError.set(null);
    this.commentsService.addComment(this.slug, body).subscribe({
      next: (res) => {
        // Prepend — BR-043: most recent first
        this.comments.update((list) => [res.comment, ...list]);
        this.newBody.set('');
        this.submitting.set(false);
      },
      error: () => {
        this.submitError.set('Could not post comment. Please try again.');
        this.submitting.set(false);
      },
    });
  }

  deleteComment(comment: Comment): void {
    this.commentsService.deleteComment(this.slug, comment.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((c) => c.id !== comment.id));
      },
    });
  }
}
