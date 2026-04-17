import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { ArticlesService, ARTICLES_PER_PAGE } from '../../core/services/articles.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfilesService, Profile } from '../../core/services/profiles.service';
import { ArticlePreviewComponent } from '../../shared/components/article-preview/article-preview';
import type { Article } from '../../core/models/article.model';

/**
 * ProfileComponent — translated from templates/accounts/profile.html.
 *
 * Source: accounts/views.py :: profile_view + profile_favorites_view + _profile_view
 * BR-010: is_following flag from GET /api/profiles/:username.
 * BR-028: paginated articles list.
 *
 * Routes:
 *   /profile/:username          → tab = 'my' articles
 *   /profile/:username/favorites → tab = 'favorites'
 */
@Component({
  selector: 'app-profile',
  imports: [RouterLink, ArticlePreviewComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly profilesService = inject(ProfilesService);
  private readonly articlesService = inject(ArticlesService);

  protected readonly profile = signal<Profile | null>(null);
  protected readonly profileNotFound = signal(false);
  protected readonly articles = signal<Article[]>([]);
  protected readonly articlesCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly followLoading = signal(false);

  protected tab: 'my' | 'favorites' = 'my';
  protected page = 1;

  protected get username(): string {
    return this.route.snapshot.paramMap.get('username') ?? '';
  }

  protected get isFavoritesRoute(): boolean {
    return this.router.url.includes('/favorites');
  }

  protected get totalPages(): number[] {
    const count = Math.ceil(this.articlesCount() / ARTICLES_PER_PAGE);
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  protected readonly isSelf = computed(() => {
    const user = this.auth.currentUser();
    return user?.username === this.profile()?.username;
  });

  ngOnInit(): void {
    this.tab = this.isFavoritesRoute ? 'favorites' : 'my';
    this.loadProfile();
    this.loadArticles();
  }

  private loadProfile(): void {
    this.profilesService.getProfile(this.username).subscribe({
      next: (res) => this.profile.set(res.profile),
      error: () => this.profileNotFound.set(true),
    });
  }

  protected setTab(tab: 'my' | 'favorites'): void {
    this.tab = tab;
    this.page = 1;
    const path = tab === 'favorites'
      ? ['/profile', this.username, 'favorites']
      : ['/profile', this.username];
    this.router.navigate(path);
    this.loadArticles();
  }

  protected setPage(p: number): void {
    this.page = p;
    this.loadArticles();
  }

  protected onFavoriteChanged(updated: Article): void {
    this.articles.update((list) => list.map((a) => (a.slug === updated.slug ? updated : a)));
  }

  protected toggleFollow(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    const p = this.profile();
    if (!p || this.followLoading()) return;
    this.followLoading.set(true);

    const action$ = p.following
      ? this.profilesService.unfollow(p.username)
      : this.profilesService.follow(p.username);

    action$.subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.followLoading.set(false);
      },
      error: () => this.followLoading.set(false),
    });
  }

  private loadArticles(): void {
    this.loading.set(true);
    const params = this.tab === 'favorites'
      ? { favorited: this.username, page: this.page }
      : { author: this.username, page: this.page };

    this.articlesService.getArticles(params).subscribe({
      next: (res) => {
        this.articles.set(res.articles);
        this.articlesCount.set(res.articlesCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
