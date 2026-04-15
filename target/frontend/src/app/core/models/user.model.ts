/**
 * User model — mirrors the fields exposed by conduit_context processor.
 *
 * Source: helpers/context_processors.py :: conduit_context (BR-003)
 * Fields: username, email, bio (null if empty), image (null if empty)
 *
 * bio and image are null when the Django source returns '' → None via
 * the "or None" guard.  The empty-string case is NOT preserved (BR-003).
 */
export interface User {
  username: string;
  email: string;
  bio: string | null;
  image: string | null;
}
