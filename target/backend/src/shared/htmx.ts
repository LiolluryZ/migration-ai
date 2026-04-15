import type { IncomingHttpHeaders } from 'http';

/**
 * Returns true if the HX-Request header equals 'true'.
 *
 * Retained as a generic header-detection utility even though HTMX disappears
 * in the SPA architecture. May be useful in transitional Strangler-Fig adapters
 * during the migration window where legacy HTMX requests coexist with the new API.
 *
 * Source: helpers/htmx.py::is_htmx()
 * Covers: BR-001
 */
export function isHtmx(headers: IncomingHttpHeaders): boolean {
  // Node.js normalises all HTTP header names to lowercase on ingress,
  // so 'HX-Request' (Django source) becomes 'hx-request' here.
  return headers['hx-request'] === 'true';
}
