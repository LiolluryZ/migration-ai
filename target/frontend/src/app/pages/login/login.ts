import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * LoginComponent — translated from templates/accounts/login.html.
 *
 * Source: accounts/views.py :: login_view (WF-001)
 * BR-011: auth by email + password, generic error on failure.
 * BR-006: JWT issued on success → stored by AuthService.
 * BR-005: redirects to `next` query param after login (or home).
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected loading = signal(false);
  protected errors = signal<string[]>([]);

  protected submit(): void {
    if (this.loading()) return;
    this.errors.set([]);
    this.loading.set(true);

    this.auth.login(this.email.trim().toLowerCase(), this.password).subscribe({
      next: () => {
        const next = this.route.snapshot.queryParamMap.get('next') ?? '/';
        this.router.navigateByUrl(next);
      },
      error: (err) => {
        // BR-011: generic error message
        const body = err?.error?.errors?.body;
        this.errors.set(Array.isArray(body) ? body : ['Invalid email or password.']);
        this.loading.set(false);
      },
    });
  }
}
