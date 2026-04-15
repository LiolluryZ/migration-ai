import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * HeaderComponent — Angular equivalent of templates/partials/header.html.
 *
 * Source: templates/partials/header.html
 * Renders authenticated nav (new article, settings, profile) or anonymous nav
 * (sign in, sign up) depending on AuthService.isAuthenticated().
 *
 * BR-003: user data (username, image) read from AuthService.currentUser signal.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
}
