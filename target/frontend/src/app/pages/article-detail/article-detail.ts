import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ArticlesService } from '../../core/services/articles.service';
import { AuthService } from '../../core/services/auth.service';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe';
import type { Article } from '../../core/models/article.model';

/**
 * ArticleDetailComponent — translated from apps/articles/views.py :: article_detail_view.
 *
 * Source: templates/articles/detail.html + templates/partials/article_meta.html
 *
 * BR-030: non-existent article → shows 404 message.
 * BR-037 CRITICAL: body (Markdown) rendered via MarkdownPipe (DOMPurify inside).
 * BR-036: favourite toggle.
 */
@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, MarkdownPipe],
  templateUrl: './article-detail.html',
  styleUrl: './article-detail.scss',
})
export class ArticleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articlesService = inject(ArticlesService);
  protected readonly auth = inject(AuthService);

  protected readonly article = signal<Article | null>(null);
  protected readonly notFound = signal(false);
  protected readonly loading = signal(true);
  protected readonly favoriteLoading = signal(false);
  protected readonly deleteLoading = signal(false);

  get isOwner(): boolean {
    const user = this.auth.currentUser();
    return !!user && user.username === this.article()?.author.username;
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.articlesService.getArticle(slug).subscribe({
      next: (res) => {
        this.article.set(res.article);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) this.notFound.set(true);
      },
    });
  }

  toggleFavorite(): void {
    if (!this.auth.isAuthenticated() || this.favoriteLoading()) return;
    const a = this.article();
    if (!a) return;
    this.favoriteLoading.set(true);
    const obs$ = a.favorited
      ? this.articlesService.unfavoriteArticle(a.slug)
      : this.articlesService.favoriteArticle(a.slug);
    obs$.subscribe({
      next: (res) => {
        this.article.set(res.article);
        this.favoriteLoading.set(false);
      },
      error: () => this.favoriteLoading.set(false),
    });
  }

  deleteArticle(): void {
    const a = this.article();
    if (!a || this.deleteLoading()) return;
    this.deleteLoading.set(true);
    this.articlesService.deleteArticle(a.slug).subscribe({
      next: () => void this.router.navigate(['/']),
      error: () => this.deleteLoading.set(false),
    });
  }
}

