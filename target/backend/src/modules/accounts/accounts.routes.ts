import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { UniqueConstraintError } from 'sequelize';
// Import from barrel to wire associations (User ↔ Follower).
import { User, Follower } from './models/index';
import { hashPassword, verifyPassword } from './helpers/password';

// ─── DTO helpers ─────────────────────────────────────────────────────────────

/**
 * Builds the { user: ... } JWT response shape returned by login, register,
 * GET /api/user, and PUT /api/user.
 *
 * Source: RealWorld spec + apps/accounts/views.py :: login_view / register_view
 * BR-006: JWT returned after successful login/register.
 * BR-007: email is the user identifier returned in the payload.
 */
function formatUser(
  user: User,
  token: string,
): { user: { email: string; token: string; username: string; bio: string; image: string | null } } {
  return {
    user: {
      email:    user.email,
      token,
      username: user.username,
      bio:      user.bio ?? '',
      image:    user.image ?? null,
    },
  };
}

/**
 * Builds the { profile: ... } shape returned by profile and follow endpoints.
 *
 * Source: apps/accounts/views.py :: _profile_view + follow_view
 * BR-010: following is asymmetric — A follows B ≠ B follows A.
 */
function formatProfile(
  user: User,
  following: boolean,
): { profile: { username: string; bio: string; image: string | null; following: boolean } } {
  return {
    profile: {
      username: user.username,
      bio:      user.bio ?? '',
      image:    user.image ?? null,
      following,
    },
  };
}

/**
 * Check whether fromUserId follows toUserId.
 * Returns false for unauthenticated callers (BR-010 edge case).
 */
async function isFollowing(fromUserId: number | null, toUserId: number): Promise<boolean> {
  if (fromUserId === null) return false;
  const count = await Follower.count({ where: { fromUserId, toUserId } });
  return count > 0;
}

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * POST /api/users/login
 *
 * Source: apps/accounts/views.py :: login_view (POST branch)
 * BR-011: auth by email + password.
 *   On failure: generic message 'Invalid email or password.' — no hint about
 *   whether the email exists (prevents user enumeration).
 * BR-006: JWT issued on success.
 *
 * RealWorld spec: 200 on success, 422 on invalid credentials.
 */
async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as { user?: { email?: string; password?: string } };
  const email    = body?.user?.email?.trim().toLowerCase();
  const password = body?.user?.password;

  if (!email || !password) {
    reply.code(422).send({ errors: { body: ['email and password are required'] } });
    return;
  }

  // BR-007: USERNAME_FIELD = 'email' → lookup by email, case-insensitive.
  const user = await User.findOne({ where: { email } });

  // BR-011: generic error message regardless of whether email exists.
  if (!user || !(await verifyPassword(password, user.password))) {
    reply.code(422).send({ errors: { body: ['Invalid email or password.'] } });
    return;
  }

  const token = (request.server as FastifyInstance).jwt.sign({
    id:       user.id!,
    username: user.username,
    email:    user.email,
  });

  reply.code(200).send(formatUser(user, token));
}

/**
 * POST /api/users
 *
 * Source: apps/accounts/views.py :: register_view (POST branch)
 * BR-013: username, email, password required.
 *         email must be unique → 'This email has already been taken.'
 *         username must be unique → 'This username has already been taken.'
 *         other IntegrityError → generic.
 * BR-014: auto-login after register → JWT in response (no session, just token).
 * BR-007: email stored lowercase (see normalisation below).
 *
 * RealWorld spec: 201 on success, 422 on validation failure.
 */
async function registerHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as {
    user?: { username?: string; email?: string; password?: string };
  };
  const username = body?.user?.username?.trim();
  const email    = body?.user?.email?.trim().toLowerCase();
  const password = body?.user?.password;

  // Validate required fields (BR-013)
  const errors: Record<string, string[]> = {};
  if (!username) errors['username'] = ['can\'t be blank'];
  if (!email)    errors['email']    = ['can\'t be blank'];
  if (!password) errors['password'] = ['can\'t be blank'];
  if (Object.keys(errors).length > 0) {
    reply.code(422).send({ errors });
    return;
  }
  // BR-007: username max_length = 60
  if (username!.length > 60) {
    reply.code(422).send({ errors: { username: ['must be 60 characters or fewer'] } });
    return;
  }

  try {
    const hashed = await hashPassword(password!);
    const user = await User.create({
      username: username!,
      email:    email!,
      password: hashed,
    });

    // BR-014: auto-login — issue JWT immediately (no redirect, REST convention)
    const token = (request.server as FastifyInstance).jwt.sign({
      id:       user.id!,
      username: user.username,
      email:    user.email,
    });

    reply.code(201).send(formatUser(user, token));
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const field = err.errors[0]?.path ?? null;
      if (field === 'email') {
        // BR-013: 'This email has already been taken.'
        reply.code(422).send({ errors: { email: ['has already been taken'] } });
      } else if (field === 'username') {
        // BR-013: 'This username has already been taken.'
        reply.code(422).send({ errors: { username: ['has already been taken'] } });
      } else {
        // BR-013: generic fallback
        reply.code(422).send({ errors: { body: ['Registration failed.'] } });
      }
      return;
    }
    throw err;
  }
}

/**
 * GET /api/user
 *
 * Source: apps/accounts/views.py :: settings_view (GET branch) + @login_required
 * BR-005: authentication required → 401 if no/invalid JWT.
 * Returns current authenticated user with a fresh JWT.
 */
async function getCurrentUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const jwtUser = request.user as { id: number };
  const user = await User.findByPk(jwtUser.id);

  if (!user) {
    // Should not happen if JWT is valid, but guard against deleted accounts.
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const token = (request.server as FastifyInstance).jwt.sign({
    id:       user.id!,
    username: user.username,
    email:    user.email,
  });

  reply.code(200).send(formatUser(user, token));
}

/**
 * PUT /api/user
 *
 * Source: apps/accounts/views.py :: settings_view (POST branch)
 * BR-015: modifiable fields: image, username, bio, email, password (all optional).
 *         If password provided → hash it (Django PBKDF2 format, BR-012).
 *         Re-issue JWT after update (email/username may have changed).
 * BR-007: email and username remain unique.
 *
 * RealWorld spec: 200 on success, 422 on validation error.
 */
async function updateUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const jwtUser = request.user as { id: number };
  const body = request.body as {
    user?: {
      email?:    string;
      username?: string;
      bio?:      string;
      image?:    string | null;
      password?: string;
    };
  };

  const user = await User.findByPk(jwtUser.id);
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const updates = body?.user ?? {};
  const errors: Record<string, string[]> = {};

  // BR-007: username max_length validation
  if (updates.username !== undefined) {
    const trimmed = updates.username.trim();
    if (!trimmed) {
      errors['username'] = ['can\'t be blank'];
    } else if (trimmed.length > 60) {
      errors['username'] = ['must be 60 characters or fewer'];
    } else {
      user.username = trimmed;
    }
  }
  if (updates.email !== undefined) {
    const trimmed = updates.email.trim().toLowerCase();
    if (!trimmed) {
      errors['email'] = ['can\'t be blank'];
    } else {
      user.email = trimmed;
    }
  }
  // BR-009: bio and image are optional, empty string / null OK
  if (updates.bio !== undefined) user.bio   = updates.bio;
  if (Object.prototype.hasOwnProperty.call(updates, 'image')) {
    user.image = updates.image ?? null;
  }
  // BR-015: if password provided → re-hash in Django PBKDF2 format (BR-012)
  if (updates.password) {
    user.password = await hashPassword(updates.password);
  }

  if (Object.keys(errors).length > 0) {
    reply.code(422).send({ errors });
    return;
  }

  try {
    await user.save();
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const field = err.errors[0]?.path ?? null;
      if (field === 'email') {
        reply.code(422).send({ errors: { email: ['has already been taken'] } });
      } else if (field === 'username') {
        reply.code(422).send({ errors: { username: ['has already been taken'] } });
      } else {
        reply.code(422).send({ errors: { body: ['Update failed.'] } });
      }
      return;
    }
    throw err;
  }

  // BR-015 note: Django calls login(request, user) after password change to keep
  // the session alive. In REST/JWT, we simply re-issue the token with updated claims.
  const token = (request.server as FastifyInstance).jwt.sign({
    id:       user.id!,
    username: user.username,
    email:    user.email,
  });

  reply.code(200).send(formatUser(user, token));
}

/**
 * GET /api/profiles/:username
 *
 * Source: apps/accounts/views.py :: profile_view / _profile_view
 * 404 for unknown username (renders profile_404.html in legacy).
 * BR-010: following = current user follows the profile user (false if anonymous).
 *
 * Note: RealWorld spec does NOT include article count in profile.
 *   Legacy profile page lists articles, but the API profile shape is just
 *   { username, bio, image, following }.
 */
async function getProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { username } = request.params as { username: string };

  const profileUser = await User.findOne({ where: { username } });
  if (!profileUser) {
    reply.code(404).send({ errors: { username: [`Profile '${username}' not found`] } });
    return;
  }

  let currentUserId: number | null = null;
  try {
    await request.jwtVerify();
    currentUserId = (request.user as { id: number }).id;
  } catch {
    // Unauthenticated — following is always false
  }

  const following = await isFollowing(currentUserId, profileUser.id!);
  reply.code(200).send(formatProfile(profileUser, following));
}

/**
 * POST /api/profiles/:username/follow
 *
 * Source: apps/accounts/views.py :: follow_view (followers.add branch)
 * BR-010: idempotent — following already followed user → 200 OK, no error.
 * BR-005: authentication required.
 *
 * Self-follow: preserved from legacy behaviour — if current user tries to
 *   follow themselves, we return following: false without inserting a row.
 *   (Legacy: `if profile_user != request.user: ... else: is_following = False`)
 */
async function followHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { username } = request.params as { username: string };
  const currentUser  = request.user as { id: number };

  const profileUser = await User.findOne({ where: { username } });
  if (!profileUser) {
    reply.code(404).send({ errors: { username: [`Profile '${username}' not found`] } });
    return;
  }

  // Legacy: self-follow silently returns is_following=false (no DB write).
  if (profileUser.id === currentUser.id) {
    reply.code(200).send(formatProfile(profileUser, false));
    return;
  }

  // BR-010: idempotent — INSERT OR IGNORE (findOrCreate)
  await Follower.findOrCreate({
    where: { fromUserId: currentUser.id, toUserId: profileUser.id! },
  });

  reply.code(200).send(formatProfile(profileUser, true));
}

/**
 * DELETE /api/profiles/:username/follow
 *
 * Source: apps/accounts/views.py :: follow_view (followers.remove branch)
 * BR-010: idempotent — unfollowing a user not followed → 200 OK without error.
 * BR-005: authentication required.
 */
async function unfollowHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { username }  = request.params as { username: string };
  const currentUser   = request.user as { id: number };

  const profileUser = await User.findOne({ where: { username } });
  if (!profileUser) {
    reply.code(404).send({ errors: { username: [`Profile '${username}' not found`] } });
    return;
  }

  // BR-010: idempotent — destroy returns 0 if row didn't exist, no error.
  await Follower.destroy({
    where: { fromUserId: currentUser.id, toUserId: profileUser.id! },
  });

  reply.code(200).send(formatProfile(profileUser, false));
}

// ─── Route registration ───────────────────────────────────────────────────────

/**
 * Registers all accounts routes under the caller's prefix (e.g. /api).
 *
 * Source: apps/accounts/urls.py :: urlpatterns
 * TM-001: Django SSR routes → Fastify REST endpoints.
 *
 * Route mapping:
 *   login_view          POST /login      → POST /api/users/login
 *   register_view       POST /register   → POST /api/users
 *   settings_view GET   GET  /settings   → GET  /api/user
 *   settings_view POST  POST /settings   → PUT  /api/user
 *   profile_view        GET  /profile/:u → GET  /api/profiles/:username
 *   follow_view POST    POST /follow     → POST /api/profiles/:username/follow
 *   follow_view DELETE  (new REST verb)  → DELETE /api/profiles/:username/follow
 */
export async function accountRoutes(fastify: FastifyInstance): Promise<void> {
  // Public routes
  fastify.post('/users/login', loginHandler);
  fastify.post('/users', registerHandler);
  fastify.get('/profiles/:username', getProfileHandler);

  // Authenticated routes
  fastify.get(
    '/user',
    { preHandler: [fastify.authenticate] },
    getCurrentUserHandler,
  );
  fastify.put(
    '/user',
    { preHandler: [fastify.authenticate] },
    updateUserHandler,
  );
  fastify.post(
    '/profiles/:username/follow',
    { preHandler: [fastify.authenticate] },
    followHandler,
  );
  fastify.delete(
    '/profiles/:username/follow',
    { preHandler: [fastify.authenticate] },
    unfollowHandler,
  );
}

// Export Op for use in articles integration (following feed)
export { Op };
