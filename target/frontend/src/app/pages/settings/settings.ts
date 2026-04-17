import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * SettingsComponent — translated from templates/accounts/settings.html.
 *
 * Source: accounts/views.py :: settings_view (WF-003)
 * BR-015: modifiable fields: image, username, bio, email, password (all optional).
 *         Password is only updated when a new one is provided.
 * BR-009: bio and image are optional (null clears the image).
 * BR-005: @login_required → canActivate: [authGuard] in app.routes.ts.
 */
@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Form fields — pre-filled from currentUser
  protected image = '';
  protected username = '';
  protected bio = '';
  protected email = '';
  protected password = '';

  protected loading = signal(false);
  protected fieldErrors = signal<Record<string, string[]>>({});

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.image    = user.image ?? '';
      this.username = user.username;
      this.bio      = user.bio ?? '';
      this.email    = user.email;
    }
  }

  protected submit(): void {
    if (this.loading()) return;
    this.fieldErrors.set({});
    this.loading.set(true);

    // BR-015: only send password when the field is non-empty
    const payload: Parameters<AuthService['updateUser']>[0] = {
      image:    this.image.trim() || null,
      username: this.username.trim(),
      bio:      this.bio.trim(),
      email:    this.email.trim().toLowerCase(),
    };
    if (this.password.trim()) {
      payload.password = this.password;
    }

    this.auth.updateUser(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate(['/profile', res.user.username]);
      },
      error: (err) => {
        this.fieldErrors.set(err?.error?.errors ?? { body: ['Update failed.'] });
        this.loading.set(false);
      },
    });
  }

  protected getErrors(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected logout(): void {
    this.auth.logout();
  }
}
