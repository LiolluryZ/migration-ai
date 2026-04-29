import { buildApp } from '../../app';
import type { FastifyInstance } from 'fastify';
import { Comment } from './models/index';
import { Article } from '../articles/models/article.model';
import { Tag } from '../articles/models/tag.model';
import { ArticleTag } from '../articles/models/article-tag.model';
import { Favorite } from '../articles/models/favorite.model';
import { UserStub } from '../articles/models/user.stub';
import { sequelize } from '../../config/sequelize.config';

// ─── Test helpers ─────────────────────────────────────────────────────────────

async function createUser(username: string): Promise<UserStub> {
  return UserStub.create({
    username,
    bio: '',
    image: null,
    email: `${username}@test.example.com`,
    // Dummy PBKDF2 hash — valid format so column NOT NULL constraint is satisfied.
    password: 'pbkdf2_sha256$1$testsalt$dGVzdGhhc2g=',
  });
}

async function createArticle(author: UserStub, title?: string): Promise<Article> {
  return Article.create({
    title: title ?? `Test article ${Date.now()}-${Math.random()}`,
    summary: '',
    content: 'Some content',
    authorId: author.id!,
  });
}

async function createComment(
  article: Article,
  author: UserStub,
  content = 'A test comment',
): Promise<Comment> {
  return Comment.create({
    content,
    articleId: article.id!,
    authorId: author.id!,
  });
}

function makeJwt(app: FastifyInstance, userId: number): string {
  return app.jwt.sign({ id: userId });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  process.env.DATABASE_URL = ':memory:';
  app = await buildApp();
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Clean all tables before each test (order respects FK dependencies)
  await Comment.destroy({ where: {} });
  await Favorite.destroy({ where: {} });
  await ArticleTag.destroy({ where: {} });
  await Article.destroy({ where: {} });
  await Tag.destroy({ where: {} });
  await UserStub.destroy({ where: {} });
});

// ─── GET /api/articles/:slug/comments ─────────────────────────────────────────

describe('GET /api/articles/:slug/comments', () => {
  it('returns empty list when article has no comments (public/anonymous)', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);

    const res = await app.inject({
      method: 'GET',
      url: `/api/articles/${article.slug}/comments`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.comments).toEqual([]);
  });

  it('returns 404 for non-existent article', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/articles/no-such-article/comments',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns list with author shape (id, createdAt, updatedAt, body, author)', async () => {
    const user = await createUser('bob');
    const article = await createArticle(user);
    await createComment(article, user, 'Hello world');

    const res = await app.inject({
      method: 'GET',
      url: `/api/articles/${article.slug}/comments`,
    });

    expect(res.statusCode).toBe(200);
    const { comments } = res.json();
    expect(comments).toHaveLength(1);
    const c = comments[0];
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('createdAt');
    expect(c).toHaveProperty('updatedAt');
    expect(c.body).toBe('Hello world');
    expect(c.author.username).toBe('bob');
    expect(c.author).toHaveProperty('bio');
    expect(c.author).toHaveProperty('image');
    expect(c.author.following).toBe(false);
  });

  it('returns comments in anti-chronological order (BR-043)', async () => {
    const user = await createUser('chrono');
    const article = await createArticle(user);

    const c1 = await createComment(article, user, 'First comment');
    const c2 = await createComment(article, user, 'Second comment');
    const c3 = await createComment(article, user, 'Third comment');

    // Set explicit timestamps so ordering is deterministic
    await Comment.update(
      { createdAt: new Date('2024-01-01') } as never,
      { where: { id: c1.id } },
    );
    await Comment.update(
      { createdAt: new Date('2024-06-01') } as never,
      { where: { id: c2.id } },
    );
    await Comment.update(
      { createdAt: new Date('2024-12-01') } as never,
      { where: { id: c3.id } },
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/articles/${article.slug}/comments`,
    });

    expect(res.statusCode).toBe(200);
    const { comments } = res.json();
    expect(comments).toHaveLength(3);
    // Most recent first (BR-043)
    expect(comments[0].body).toBe('Third comment');
    expect(comments[1].body).toBe('Second comment');
    expect(comments[2].body).toBe('First comment');
  });
});

// ─── POST /api/articles/:slug/comments ────────────────────────────────────────

describe('POST /api/articles/:slug/comments', () => {
  it('returns 401 if unauthenticated (BR-040)', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);

    const res = await app.inject({
      method: 'POST',
      url: `/api/articles/${article.slug}/comments`,
      payload: { comment: { body: 'Test comment' } },
    });

    expect(res.statusCode).toBe(401);
  });

  it('creates a comment and returns 201 with comment shape', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);
    const token = makeJwt(app, user.id!);

    const res = await app.inject({
      method: 'POST',
      url: `/api/articles/${article.slug}/comments`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { comment: { body: 'My comment' } },
    });

    expect(res.statusCode).toBe(201);
    const { comment } = res.json();
    expect(comment.body).toBe('My comment');
    expect(comment.author.username).toBe('alice');
    expect(comment).toHaveProperty('id');
    expect(comment).toHaveProperty('createdAt');
    expect(comment).toHaveProperty('updatedAt');
  });

  it('returns 422 if body is empty (BR-039)', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);
    const token = makeJwt(app, user.id!);

    const res = await app.inject({
      method: 'POST',
      url: `/api/articles/${article.slug}/comments`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { comment: { body: '' } },
    });

    expect(res.statusCode).toBe(422);
  });

  it('returns 422 if body is whitespace-only (BR-039)', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);
    const token = makeJwt(app, user.id!);

    const res = await app.inject({
      method: 'POST',
      url: `/api/articles/${article.slug}/comments`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { comment: { body: '   ' } },
    });

    expect(res.statusCode).toBe(422);
  });

  it('returns 404 if article does not exist', async () => {
    const user = await createUser('alice');
    const token = makeJwt(app, user.id!);

    const res = await app.inject({
      method: 'POST',
      url: '/api/articles/no-such-article/comments',
      headers: { Authorization: `Bearer ${token}` },
      payload: { comment: { body: 'Hello' } },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── DELETE /api/articles/:slug/comments/:id ──────────────────────────────────

describe('DELETE /api/articles/:slug/comments/:id', () => {
  it('returns 401 if unauthenticated', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);
    const comment = await createComment(article, user);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}/comments/${comment.id}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('allows comment author to delete (BR-041)', async () => {
    const author = await createUser('comment_author');
    const articleOwner = await createUser('article_owner');
    const article = await createArticle(articleOwner);
    const comment = await createComment(article, author);
    const token = makeJwt(app, author.id!);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}/comments/${comment.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);

    // Verify the comment is gone
    const deleted = await Comment.findByPk(comment.id);
    expect(deleted).toBeNull();
  });

  it('allows article author to delete (BR-041)', async () => {
    const commentAuthor = await createUser('comment_author');
    const articleOwner = await createUser('article_owner');
    const article = await createArticle(articleOwner);
    const comment = await createComment(article, commentAuthor);
    const token = makeJwt(app, articleOwner.id!);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}/comments/${comment.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);

    const deleted = await Comment.findByPk(comment.id);
    expect(deleted).toBeNull();
  });

  it('returns 403 if user is neither comment author nor article author (BR-041)', async () => {
    const articleOwner = await createUser('article_owner');
    const commentAuthor = await createUser('comment_author');
    const thirdParty = await createUser('third_party');
    const article = await createArticle(articleOwner);
    const comment = await createComment(article, commentAuthor);
    const token = makeJwt(app, thirdParty.id!);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}/comments/${comment.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 if article does not exist', async () => {
    const user = await createUser('alice');
    const token = makeJwt(app, user.id!);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/articles/no-such-article/comments/1',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 if comment does not exist', async () => {
    const user = await createUser('alice');
    const article = await createArticle(user);
    const token = makeJwt(app, user.id!);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}/comments/99999`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── BR-042: Cascade delete ────────────────────────────────────────────────────

describe('BR-042: cascade — deleting an article removes its comments', () => {
  it('comments are destroyed when article is deleted (BR-042)', async () => {
    const owner = await createUser('owner');
    const commenter = await createUser('commenter');
    const article = await createArticle(owner);
    const comment = await createComment(article, commenter, 'Will be cascaded');
    const token = makeJwt(app, owner.id!);

    // Verify comment exists
    expect(await Comment.findByPk(comment.id)).not.toBeNull();

    // Delete the article via API
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);

    // BR-042: comment must be gone after article deletion
    const cascaded = await Comment.findByPk(comment.id);
    expect(cascaded).toBeNull();
  });

  it('cascade removes all comments for the deleted article (BR-042)', async () => {
    const owner = await createUser('owner2');
    const article = await createArticle(owner);

    await createComment(article, owner, 'Comment 1');
    await createComment(article, owner, 'Comment 2');
    await createComment(article, owner, 'Comment 3');

    const token = makeJwt(app, owner.id!);

    // Delete article
    await app.inject({
      method: 'DELETE',
      url: `/api/articles/${article.slug}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    // All comments should be gone
    const remaining = await Comment.findAll({ where: { articleId: article.id } });
    expect(remaining).toHaveLength(0);
  });
});
