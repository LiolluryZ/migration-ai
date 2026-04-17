import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * RegisterComponent — translated from templates/accounts/register.html.
 *
 * Source: accounts/views.py :: register_view (WF-002)
 * BR-013: username, email, password required; email + username must be unique.
 * BR-014: auto-login after register (JWT in response).
 */
@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected username = '';
  protected email = '';
  protected password = '';
  protected loading = signal(false);
  protected fieldErrors = signal<Record<string, string[]>>({});

  protected submit(): void {
    if (this.loading()) return;
    this.fieldErrors.set({});
    this.loading.set(true);

    this.auth.register(
      this.username.trim(),
      this.email.trim().toLowerCase(),
      this.password,
    ).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        // BR-013: per-field errors or generic
        this.fieldErrors.set(err?.error?.errors ?? { body: ['Registration failed.'] });
        this.loading.set(false);
      },
    });
  }

  protected getErrors(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }
}
