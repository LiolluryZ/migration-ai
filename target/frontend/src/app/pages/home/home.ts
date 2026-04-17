import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticlesService, ARTICLES_PER_PAGE } from '../../core/services/articles.service';
import { AuthService } from '../../core/services/auth.service';
import { ArticlePreviewComponent } from '../../shared/components/article-preview/article-preview';
import type { Article } from '../../core/models/article.model';

/**
 * HomeComponent — translated from apps/articles/views.py :: home_view + _build_feed.
 *
 * Source: templates/articles/home.html + templates/partials/feed_content.html
 *
 * BR-026: 3 tabs: global / following (auth only) / tag
 * BR-028: paginated, 10 per page, ordered by date DESC (server-side)
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ArticlePreviewComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly articlesService = inject(ArticlesService);

  protected readonly articles = signal<Article[]>([]);
  protected readonly articlesCount = signal(0);
  protected readonly tags = signal<string[]>([]);
  protected readonly loading = signal(false);

  protected activeTab: 'global' | 'following' | 'tag' = 'global';
  protected activeTag: string | null = null;
  protected page = 1;

  get totalPages(): number[] {
    const count = Math.ceil(this.articlesCount() / ARTICLES_PER_PAGE);
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  ngOnInit(): void {
    this.loadArticles();
    this.loadTags();
  }

  protected setTab(tab: 'global' | 'following'): void {
    this.activeTab = tab;
    this.activeTag = null;
    this.page = 1;
    this.loadArticles();
  }

  protected setTagFilter(tag: string): void {
    this.activeTab = 'tag';
    this.activeTag = tag;
    this.page = 1;
    this.loadArticles();
  }

  protected setPage(p: number): void {
    this.page = p;
    this.loadArticles();
  }

  protected onFavoriteChanged(updated: Article): void {
    this.articles.update((list) => list.map((a) => (a.slug === updated.slug ? updated : a)));
  }

  private loadArticles(): void {
    this.loading.set(true);
    const params =
      this.activeTab === 'following'
        ? { feed: 'following' as const, page: this.page }
        : this.activeTab === 'tag' && this.activeTag
        ? { tag: this.activeTag, page: this.page }
        : { page: this.page };

    this.articlesService.getArticles(params).subscribe({
      next: (res) => {
        this.articles.set(res.articles);
        this.articlesCount.set(res.articlesCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTags(): void {
    // Fetch available tags for the sidebar.
    // Source: apps/articles/views.py :: tags = cache.get_or_set("all_tags", Tag.objects.all, timeout=300)
    // In the SPA, tags are fetched on page load (no 5-min cache — simplification documented in translation_log).
    this.articlesService.getTags().subscribe({
      next: (res) => this.tags.set(res.tags),
      error: () => this.tags.set([]),
    });
  }
}

