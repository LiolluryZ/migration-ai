import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Article } from '../../../core/models/article.model';
import { AuthService } from '../../../core/services/auth.service';
import { ArticlesService } from '../../../core/services/articles.service';

/**
 * ArticlePreviewComponent — reusable article card in feed lists.
 *
 * Source: templates/partials/article_list.html — single article-preview block.
 * Translated to a standalone Angular component with reactive favorite toggle.
 *
 * BR-036: favorite is a toggle — clicking while favorited removes it.
 * BR-025: emits (favoriteChanged) so parent can refresh the count if needed.
 */
@Component({
  selector: 'app-article-preview',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './article-preview.html',
  styleUrl: './article-preview.scss',
})
export class ArticlePreviewComponent {
  @Input({ required: true }) article!: Article;
  @Output() readonly favoriteChanged = new EventEmitter<Article>();

  protected readonly auth = inject(AuthService);
  private readonly articlesService = inject(ArticlesService);

  protected favoriteLoading = false;

  toggleFavorite(event: Event): void {
    event.preventDefault();
    if (!this.auth.isAuthenticated()) return;
    if (this.favoriteLoading) return;

    this.favoriteLoading = true;
    const obs$ = this.article.favorited
      ? this.articlesService.unfavoriteArticle(this.article.slug)
      : this.articlesService.favoriteArticle(this.article.slug);

    obs$.subscribe({
      next: (res) => {
        this.favoriteLoading = false;
        this.favoriteChanged.emit(res.article);
      },
      error: () => {
        this.favoriteLoading = false;
      },
    });
  }
}
