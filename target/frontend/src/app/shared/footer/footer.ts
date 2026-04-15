import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * FooterComponent — Angular equivalent of templates/partials/footer.html.
 * Source: templates/partials/footer.html
 */
@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class FooterComponent {}
