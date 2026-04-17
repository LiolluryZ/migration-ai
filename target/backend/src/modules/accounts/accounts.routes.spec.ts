import { buildApp } from '../../app';
import type { FastifyInstance } from 'fastify';
// Import from barrel to ensure associations (User ↔ Follower) are wired.
import { User } from './models/user.model';
import { Follower } from './models/follower.model';
import { sequelize } from '../../config/sequelize.config';

// ─── Test helpers ─────────────────────────────────────────────────────────────

interface UserFixture {
  email:    string;
  username: string;
  password: string; // plain-text (hashed at creation inside the helper)
}

/**
 * Create a User in the test DB — hashing is fast because PBKDF2_ITERATIONS=1
 * is set by jest.config.ts.
 */
async function createTestUser(fixture: UserFixture): Promise<User> {
  const { hashPassword } = await import('./helpers/password');
  return User.create({
    email:    fixture.email.toLowerCase(),
    username: fixture.username,
    password: await hashPassword(fixture.password),
  });
}

/** Sign a JWT with accounts payload (id + username + email). */
function makeJwt(app: FastifyInstance, user: User): string {
  return app.jwt.sign({ id: user.id!, username: user.username, email: user.email });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  process.env.DATABASE_URL = ':memory:';
  app = await buildApp();
  // Sync only accounts tables (User must come before Follower due to FK).
  await User.sync({ force: true });
  await Follower.sync({ force: true });
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Clean up in FK-safe order: followers first, then users.
  await Follower.destroy({ where: {} });
  await User.destroy({ where: {} });
});

// ─── POST /api/users — register ───────────────────────────────────────────────

describe('POST /api/users (register)', () => {
  it('creates a user and returns JWT (BR-013, BR-014, BR-006)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { username: 'alice', email: 'Alice@Test.com', password: 'pass123' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.username).toBe('alice');
    // BR-007: email stored lowercase
    expect(body.user.email).toBe('alice@test.com');
    expect(body.user.token).toBeTruthy();
    expect(body.user).not.toHaveProperty('password');
  });

  it('returns 422 when username is missing (BR-013)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { email: 'x@x.com', password: 'pass' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.username).toBeDefined();
  });

  it('returns 422 when email is missing (BR-013)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { username: 'bob', password: 'pass' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.email).toBeDefined();
  });

  it('returns 422 when password is missing (BR-013)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { username: 'bob', email: 'bob@x.com' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.password).toBeDefined();
  });

  it('returns 422 with email error on duplicate email (BR-013, BR-001)', async () => {
    await createTestUser({ email: 'dup@x.com', username: 'original', password: 'p' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { username: 'other', email: 'dup@x.com', password: 'pass' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.email).toContain('has already been taken');
  });

  it('returns 422 with username error on duplicate username (BR-013, BR-002)', async () => {
    await createTestUser({ email: 'first@x.com', username: 'taken', password: 'p' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { username: 'taken', email: 'second@x.com', password: 'pass' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.username).toContain('has already been taken');
  });

  it('returns 422 when username exceeds 60 characters (BR-007)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { user: { username: 'a'.repeat(61), email: 'x@x.com', password: 'pass' } },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ─── POST /api/users/login ────────────────────────────────────────────────────

describe('POST /api/users/login', () => {
  it('returns 200 with JWT on valid credentials (BR-011, BR-006)', async () => {
    await createTestUser({ email: 'user@x.com', username: 'loginuser', password: 'secret' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { user: { email: 'user@x.com', password: 'secret' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.token).toBeTruthy();
    expect(body.user.email).toBe('user@x.com');
  });

  it('is case-insensitive for email lookup (BR-007)', async () => {
    await createTestUser({ email: 'User@X.com', username: 'caseuser', password: 'secret' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { user: { email: 'USER@X.COM', password: 'secret' } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 422 with generic message on wrong password (BR-011)', async () => {
    await createTestUser({ email: 'u@x.com', username: 'pwduser', password: 'correct' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { user: { email: 'u@x.com', password: 'wrong' } },
    });
    expect(res.statusCode).toBe(422);
    // BR-011: generic message regardless of whether email or password is wrong
    expect(res.json().errors.body).toContain('Invalid email or password.');
  });

  it('returns 422 with generic message on unknown email (BR-011)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { user: { email: 'nobody@x.com', password: 'any' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.body).toContain('Invalid email or password.');
  });

  it('returns 422 when fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { user: { email: 'x@x.com' } },
    });
    expect(res.statusCode).toBe(422);
  });
});

// ─── GET /api/user ────────────────────────────────────────────────────────────

describe('GET /api/user', () => {
  it('returns current user with fresh JWT when authenticated (BR-005)', async () => {
    const user = await createTestUser({ email: 'me@x.com', username: 'me', password: 'p' });
    const token = makeJwt(app, user);

    const res = await app.inject({
      method: 'GET',
      url: '/api/user',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.username).toBe('me');
    expect(body.user.email).toBe('me@x.com');
    expect(body.user.token).toBeTruthy();
  });

  it('returns 401 without JWT (BR-005)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with invalid JWT (BR-005)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/user',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PUT /api/user ────────────────────────────────────────────────────────────

describe('PUT /api/user', () => {
  it('updates bio and image (BR-015, BR-009)', async () => {
    const user = await createTestUser({ email: 'upd@x.com', username: 'updater', password: 'p' });
    const token = makeJwt(app, user);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user',
      headers: { authorization: `Bearer ${token}` },
      payload: { user: { bio: 'Hello world', image: 'https://example.com/img.png' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.bio).toBe('Hello world');
    expect(body.user.image).toBe('https://example.com/img.png');
  });

  it('updates email (BR-015, BR-007)', async () => {
    const user = await createTestUser({ email: 'old@x.com', username: 'emailchanger', password: 'p' });
    const token = makeJwt(app, user);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user',
      headers: { authorization: `Bearer ${token}` },
      payload: { user: { email: 'New@X.com' } },
    });
    expect(res.statusCode).toBe(200);
    // BR-007: email normalised to lowercase
    expect(res.json().user.email).toBe('new@x.com');
    // JWT reflects new email
    expect(res.json().user.token).toBeTruthy();
  });

  it('updates password and returns new JWT (BR-015, BR-012)', async () => {
    const user = await createTestUser({ email: 'pwd@x.com', username: 'pwdchanger', password: 'old' });
    const token = makeJwt(app, user);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user',
      headers: { authorization: `Bearer ${token}` },
      payload: { user: { password: 'newpassword' } },
    });
    expect(res.statusCode).toBe(200);

    // Verify new password works for login (BR-012: hashed in Django PBKDF2 format)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/users/login',
      payload: { user: { email: 'pwd@x.com', password: 'newpassword' } },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it('returns 422 on duplicate email (BR-015, BR-001)', async () => {
    const u1 = await createTestUser({ email: 'taken@x.com', username: 'u1', password: 'p' });
    const u2 = await createTestUser({ email: 'free@x.com',  username: 'u2', password: 'p' });
    const token = makeJwt(app, u2);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user',
      headers: { authorization: `Bearer ${token}` },
      payload: { user: { email: 'taken@x.com' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().errors.email).toContain('has already been taken');
  });

  it('returns 401 without JWT (BR-005)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user',
      payload: { user: { bio: 'test' } },
    });
    expect(res.statusCode).toBe(401);
  });

  it('sets image to null when explicitly passed null (BR-009)', async () => {
    const user = await createTestUser({ email: 'img@x.com', username: 'imguser', password: 'p' });
    await user.update({ image: 'https://example.com/img.png' });
    const token = makeJwt(app, user);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/user',
      headers: { authorization: `Bearer ${token}` },
      payload: { user: { image: null } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.image).toBeNull();
  });
});

// ─── GET /api/profiles/:username ─────────────────────────────────────────────

describe('GET /api/profiles/:username', () => {
  it('returns profile for an existing user (BR-009, BR-010)', async () => {
    await createTestUser({ email: 'pub@x.com', username: 'pubuser', password: 'p' });

    const res = await app.inject({ method: 'GET', url: '/api/profiles/pubuser' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.profile.username).toBe('pubuser');
    expect(body.profile.following).toBe(false);
  });

  it('returns 404 for unknown username', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/profiles/nobody' });
    expect(res.statusCode).toBe(404);
  });

  it('shows following=true when authenticated follower requests profile (BR-010)', async () => {
    const target  = await createTestUser({ email: 't@x.com', username: 'target', password: 'p' });
    const current = await createTestUser({ email: 'c@x.com', username: 'current', password: 'p' });
    await Follower.create({ fromUserId: current.id!, toUserId: target.id! });

    const token = makeJwt(app, current);
    const res = await app.inject({
      method: 'GET',
      url: '/api/profiles/target',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.following).toBe(true);
  });

  it('shows following=false for anonymous visitor (BR-010 edge case)', async () => {
    await createTestUser({ email: 'anon@x.com', username: 'anonprofile', password: 'p' });
    const res = await app.inject({ method: 'GET', url: '/api/profiles/anonprofile' });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.following).toBe(false);
  });
});

// ─── POST /api/profiles/:username/follow ──────────────────────────────────────

describe('POST /api/profiles/:username/follow', () => {
  it('follows a user and returns following=true (BR-010)', async () => {
    const target  = await createTestUser({ email: 'f_t@x.com', username: 'f_target', password: 'p' });
    const current = await createTestUser({ email: 'f_c@x.com', username: 'f_current', password: 'p' });
    const token   = makeJwt(app, current);

    const res = await app.inject({
      method: 'POST',
      url: `/api/profiles/${target.username}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.following).toBe(true);

    // Verify row exists in DB
    const row = await Follower.findOne({ where: { fromUserId: current.id, toUserId: target.id } });
    expect(row).not.toBeNull();
  });

  it('is idempotent — following already followed user returns 200 (BR-010)', async () => {
    const target  = await createTestUser({ email: 'if_t@x.com', username: 'if_target', password: 'p' });
    const current = await createTestUser({ email: 'if_c@x.com', username: 'if_current', password: 'p' });
    await Follower.create({ fromUserId: current.id!, toUserId: target.id! });
    const token = makeJwt(app, current);

    const res = await app.inject({
      method: 'POST',
      url: `/api/profiles/${target.username}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    // Still only one follower row
    const count = await Follower.count({ where: { fromUserId: current.id, toUserId: target.id } });
    expect(count).toBe(1);
  });

  it('returns 401 without JWT (BR-005)', async () => {
    await createTestUser({ email: 'noauth@x.com', username: 'noauth', password: 'p' });
    const res = await app.inject({ method: 'POST', url: '/api/profiles/noauth/follow' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown profile', async () => {
    const current = await createTestUser({ email: 'fn@x.com', username: 'fnuser', password: 'p' });
    const token   = makeJwt(app, current);
    const res = await app.inject({
      method: 'POST',
      url: '/api/profiles/nobody/follow',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('self-follow returns following=false without DB write (legacy behaviour)', async () => {
    const user  = await createTestUser({ email: 'self@x.com', username: 'selfuser', password: 'p' });
    const token = makeJwt(app, user);

    const res = await app.inject({
      method: 'POST',
      url: `/api/profiles/${user.username}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.following).toBe(false);
    // No row created
    const count = await Follower.count({ where: { fromUserId: user.id, toUserId: user.id } });
    expect(count).toBe(0);
  });
});

// ─── DELETE /api/profiles/:username/follow ────────────────────────────────────

describe('DELETE /api/profiles/:username/follow', () => {
  it('unfollows a user and returns following=false (BR-010)', async () => {
    const target  = await createTestUser({ email: 'uf_t@x.com', username: 'uf_target', password: 'p' });
    const current = await createTestUser({ email: 'uf_c@x.com', username: 'uf_current', password: 'p' });
    await Follower.create({ fromUserId: current.id!, toUserId: target.id! });
    const token = makeJwt(app, current);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/profiles/${target.username}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.following).toBe(false);

    // Row deleted
    const count = await Follower.count({ where: { fromUserId: current.id, toUserId: target.id } });
    expect(count).toBe(0);
  });

  it('is idempotent — unfollowing a non-followed user returns 200 (BR-010)', async () => {
    const target  = await createTestUser({ email: 'ui_t@x.com', username: 'ui_target', password: 'p' });
    const current = await createTestUser({ email: 'ui_c@x.com', username: 'ui_current', password: 'p' });
    const token   = makeJwt(app, current);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/profiles/${target.username}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.following).toBe(false);
  });

  it('returns 401 without JWT (BR-005)', async () => {
    await createTestUser({ email: 'uauth@x.com', username: 'uauth', password: 'p' });
    const res = await app.inject({ method: 'DELETE', url: '/api/profiles/uauth/follow' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for unknown profile', async () => {
    const current = await createTestUser({ email: 'ud@x.com', username: 'uduser', password: 'p' });
    const token   = makeJwt(app, current);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/profiles/nobody/follow',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
