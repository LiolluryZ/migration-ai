import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { FooterComponent } from './shared/footer/footer';

/**
 * App shell — translated from templates/base.html.
 *
 * Source: templates/base.html
 * Django base template wraps all pages with header + footer.
 * In Angular, the AppComponent (selector app-root) plays the same role.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
