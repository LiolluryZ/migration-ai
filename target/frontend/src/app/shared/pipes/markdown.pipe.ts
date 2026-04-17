import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * MarkdownPipe — translates the Django server-side Markdown renderer.
 *
 * Source: apps/articles/templatetags/markdown_filter.py :: render_markdown
 *   return mark_safe(nh3.clean(md.markdown(value, extensions=["extra"])))
 *
 * BR-037 CRITICAL: Markdown must be sanitised before rendering to prevent XSS.
 *   Django uses nh3 (Rust HTML sanitiser).
 *   Angular target uses DOMPurify (industry-standard JS sanitiser).
 *   Phase 2 audit identified this as a high-priority XSS gap.
 *
 * Usage: {{ article.body | markdown }}
 *
 * Security note: DomSanitizer.bypassSecurityTrustHtml() is safe here BECAUSE
 * the content is first cleaned by DOMPurify. Never use bypassSecurityTrustHtml
 * on unsanitised user input.
 */
@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';

    // Step 1: Render Markdown to HTML (equivalent to md.markdown(value, extensions=["extra"]))
    const rawHtml = marked.parse(value, { async: false }) as string;

    // Step 2: Sanitise HTML with DOMPurify (equivalent to nh3.clean()) — BR-037
    const clean = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'div', 'span',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
    });

    // Step 3: Trust the sanitised HTML for Angular rendering
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
