import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ArticlesService } from '../../core/services/articles.service';

/**
 * EditorComponent — translated from apps/articles/views.py ::
 * article_create_view (GET/POST /editor) and article_edit_view (GET/POST /editor/:slug).
 *
 * Source: templates/articles/editor.html
 * BR-033: creation requires auth (enforced by authGuard in routes).
 * BR-022: title required, max 150 chars, unique.
 * BR-023 CRITICAL: in edit mode, slug MUST NOT be sent in PATCH body.
 * BR-031: form.description → API "description" (model.summary); form.body → API "body" (model.content).
 * BR-032: tags cleared and re-added on each save.
 * BR-026: tags normalised to lowercase (server-side too, but we normalise on input for UX).
 */
@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
})
export class EditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articlesService = inject(ArticlesService);

  // Edit mode when :slug is present in the route
  protected editSlug: string | null = null;

  // Form fields — mirror ArticleForm fields (BR-031)
  protected title = '';
  protected description = '';  // BR-031: form.description → model.summary
  protected body = '';          // BR-031: form.body → model.content
  protected tagInput = '';      // User types tags comma-separated
  protected tags: string[] = [];

  protected loading = signal(false);
  protected errors = signal<Record<string, string[]>>({});
  protected hasErrors = computed(() => Object.keys(this.errors()).length > 0);
  protected errorKeys = computed(() => Object.keys(this.errors()));

  ngOnInit(): void {
    this.editSlug = this.route.snapshot.paramMap.get('slug');
    if (this.editSlug) {
      this.loadArticle(this.editSlug);
    }
  }

  // ─── Tag input helpers ──────────────────────────────────────────────────

  addTag(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const name = this.tagInput.trim().toLowerCase(); // BR-026: lowercase
      if (name && !this.tags.includes(name)) {
        this.tags = [...this.tags, name];
      }
      this.tagInput = '';
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  submit(): void {
    if (this.loading()) return;
    this.errors.set({});
    this.loading.set(true);

    const obs$ = this.editSlug
      ? // BR-023 CRITICAL: update NEVER sends slug in body
        this.articlesService.updateArticle(this.editSlug, {
          article: {
            title: this.title,
            description: this.description,
            body: this.body,
            tagList: this.tags,
          },
        })
      : this.articlesService.createArticle({
          article: {
            title: this.title,
            description: this.description,
            body: this.body,
            tagList: this.tags,
          },
        });

    obs$.subscribe({
      next: (res) => {
        this.loading.set(false);
        void this.router.navigate(['/article', res.article.slug]);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 422 && err.error?.errors) {
          this.errors.set(err.error.errors);
        }
      },
    });
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private loadArticle(slug: string): void {
    this.loading.set(true);
    this.articlesService.getArticle(slug).subscribe({
      next: (res) => {
        const a = res.article;
        this.title = a.title;
        this.description = a.description;
        this.body = a.body;
        this.tags = [...a.tagList];
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate(['/']);
      },
    });
  }
}

