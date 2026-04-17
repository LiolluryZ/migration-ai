"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("../../app");
const article_model_1 = require("./models/article.model");
const tag_model_1 = require("./models/tag.model");
const article_tag_model_1 = require("./models/article-tag.model");
const favorite_model_1 = require("./models/favorite.model");
const user_stub_1 = require("./models/user.stub");
const sequelize_config_1 = require("../../config/sequelize.config");
const articles_routes_1 = require("./articles.routes");
// ─── Test helpers ─────────────────────────────────────────────────────────
async function createUser(username, id) {
    return user_stub_1.UserStub.create({ ...(id ? { id } : {}), username, bio: null, image: null });
}
async function createArticleForUser(user, overrides = {}) {
    return article_model_1.Article.create({
        title: overrides.title ?? `Test article ${Date.now()}-${Math.random()}`,
        summary: overrides.summary ?? '',
        content: overrides.content ?? 'Some content',
        authorId: user.id,
    });
}
function makeJwt(app, userId) {
    return app.jwt.sign({ id: userId });
}
// ─── Setup / teardown ─────────────────────────────────────────────────────
let app;
beforeAll(async () => {
    process.env.DATABASE_URL = ':memory:';
    app = await (0, app_1.buildApp)();
    // Sync all tables
    await sequelize_config_1.sequelize.sync({ force: true });
});
afterAll(async () => {
    await app.close();
});
beforeEach(async () => {
    // Clean all tables before each test
    await favorite_model_1.Favorite.destroy({ where: {} });
    await article_tag_model_1.ArticleTag.destroy({ where: {} });
    await article_model_1.Article.destroy({ where: {} });
    await tag_model_1.Tag.destroy({ where: {} });
    await user_stub_1.UserStub.destroy({ where: {} });
});
// ─── GET /api/articles ──────────────────────────────────────────────────────
describe('GET /api/articles', () => {
    it('returns an empty list when no articles exist', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/articles' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.articles).toEqual([]);
        expect(body.articlesCount).toBe(0);
    });
    it('returns articles ordered by date descending (BR-028)', async () => {
        const user = await createUser('alice');
        // Create articles with explicit delay to ensure ordering
        const a1 = await createArticleForUser(user, { title: 'First article' });
        // Manually set updatedAt to different dates so the sort is deterministic
        await article_model_1.Article.update({ createdAt: new Date('2024-01-01') }, { where: { id: a1.id } });
        const a2 = await createArticleForUser(user, { title: 'Second article' });
        await article_model_1.Article.update({ createdAt: new Date('2024-06-01') }, { where: { id: a2.id } });
        const res = await app.inject({ method: 'GET', url: '/api/articles' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.articlesCount).toBe(2);
        // Most recent first
        expect(body.articles[0].title).toBe('Second article');
        expect(body.articles[1].title).toBe('First article');
    });
    it('ARTICLES_PER_PAGE constant equals 10 (BR-028)', () => {
        expect(articles_routes_1.ARTICLES_PER_PAGE).toBe(10);
    });
    it('paginates results (BR-028)', async () => {
        const user = await createUser('paginator');
        for (let i = 1; i <= 12; i++) {
            await createArticleForUser(user, { title: `Article ${i}` });
        }
        const page1 = await app.inject({ method: 'GET', url: '/api/articles?page=1' });
        const page2 = await app.inject({ method: 'GET', url: '/api/articles?page=2' });
        expect(page1.json().articles.length).toBe(10);
        expect(page2.json().articles.length).toBe(2);
        expect(page1.json().articlesCount).toBe(12);
    });
    it('filters by tag', async () => {
        const user = await createUser('tagger');
        const article = await createArticleForUser(user, { title: 'Tagged article' });
        const [tag] = await tag_model_1.Tag.findOrCreate({ where: { name: 'typescript' } });
        await article_tag_model_1.ArticleTag.create({ articleId: article.id, tagId: tag.id });
        await createArticleForUser(user, { title: 'Untagged article' });
        const res = await app.inject({ method: 'GET', url: '/api/articles?tag=typescript' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.articlesCount).toBe(1);
        expect(body.articles[0].title).toBe('Tagged article');
    });
    it('filters by author username', async () => {
        const alice = await createUser('alice2');
        const bob = await createUser('bob2');
        await createArticleForUser(alice, { title: 'Alice article' });
        await createArticleForUser(bob, { title: 'Bob article' });
        const res = await app.inject({ method: 'GET', url: '/api/articles?author=alice2' });
        expect(res.statusCode).toBe(200);
        expect(res.json().articlesCount).toBe(1);
        expect(res.json().articles[0].title).toBe('Alice article');
    });
    it('returns 401 when feed=following and unauthenticated', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/articles?feed=following' });
        expect(res.statusCode).toBe(401);
    });
});
// ─── GET /api/articles/:slug ────────────────────────────────────────────────
describe('GET /api/articles/:slug', () => {
    it('returns 404 for non-existent slug (BR-030)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/articles/does-not-exist' });
        expect(res.statusCode).toBe(404);
    });
    it('returns article with correct field mapping (BR-031)', async () => {
        const user = await createUser('author1');
        await createArticleForUser(user, {
            title: 'My article',
            summary: 'A summary',
            content: 'The body text',
        });
        const list = await app.inject({ method: 'GET', url: '/api/articles' });
        const slug = list.json().articles[0].slug;
        const res = await app.inject({ method: 'GET', url: `/api/articles/${slug}` });
        expect(res.statusCode).toBe(200);
        const a = res.json().article;
        // BR-031: summary → description, content → body
        expect(a.description).toBe('A summary');
        expect(a.body).toBe('The body text');
        expect(a.slug).toBe(slug);
        expect(a.author.username).toBe('author1');
    });
});
// ─── POST /api/articles ─────────────────────────────────────────────────────
describe('POST /api/articles', () => {
    it('creates an article and generates slug from title (BR-023)', async () => {
        const user = await createUser('creator1');
        const token = makeJwt(app, user.id);
        const res = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Hello World', description: 'desc', body: 'body text', tagList: [] } },
        });
        expect(res.statusCode).toBe(201);
        const a = res.json().article;
        expect(a.title).toBe('Hello World');
        expect(a.slug).toContain('hello-world'); // slug derived from title
        expect(a.description).toBe('desc'); // BR-031
        expect(a.body).toBe('body text'); // BR-031
    });
    it('returns 401 when unauthenticated', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/articles',
            payload: { article: { title: 'New' } },
        });
        expect(res.statusCode).toBe(401);
    });
    it('returns 422 when title is missing (BR-022)', async () => {
        const user = await createUser('creator2');
        const token = makeJwt(app, user.id);
        const res = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: '', description: 'x' } },
        });
        expect(res.statusCode).toBe(422);
        expect(res.json().errors.title).toBeDefined();
    });
    it('returns 422 on duplicate title (BR-022)', async () => {
        const user = await createUser('creator3');
        const token = makeJwt(app, user.id);
        await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Unique title' } },
        });
        const res2 = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Unique title' } },
        });
        expect(res2.statusCode).toBe(422);
        expect(res2.json().errors.title).toBeDefined();
    });
    it('normalises tags to lowercase (BR-026)', async () => {
        const user = await createUser('tagger2');
        const token = makeJwt(app, user.id);
        const res = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Tagged article x', tagList: ['TypeScript', 'ANGULAR', 'testing'] } },
        });
        expect(res.statusCode).toBe(201);
        const tagList = res.json().article.tagList;
        expect(tagList).toContain('typescript');
        expect(tagList).toContain('angular');
        expect(tagList).toContain('testing');
        expect(tagList).not.toContain('TypeScript');
    });
});
// ─── PATCH /api/articles/:slug ──────────────────────────────────────────────
describe('PATCH /api/articles/:slug', () => {
    it('CRITICAL: rejects slug modification (BR-023)', async () => {
        const user = await createUser('editor1');
        const token = makeJwt(app, user.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Original title' } },
        });
        const { slug } = create.json().article;
        const res = await app.inject({
            method: 'PATCH',
            url: `/api/articles/${slug}`,
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { slug: 'new-slug', title: 'Updated title' } },
        });
        expect(res.statusCode).toBe(422);
        expect(res.json().errors.slug).toContain('must not be modified');
    });
    it('returns 404 for non-owner (BR-034)', async () => {
        const owner = await createUser('owner1');
        const other = await createUser('other1');
        const ownerToken = makeJwt(app, owner.id);
        const otherToken = makeJwt(app, other.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${ownerToken}` },
            payload: { article: { title: 'Owner article 1' } },
        });
        const { slug } = create.json().article;
        const res = await app.inject({
            method: 'PATCH',
            url: `/api/articles/${slug}`,
            headers: { authorization: `Bearer ${otherToken}` },
            payload: { article: { title: 'Hijacked title' } },
        });
        // BR-034: non-owner → 404 (not 403), mirrors Django get_object_or_404(Article, slug=slug, author=request.user)
        expect(res.statusCode).toBe(404);
    });
    it('updates title without changing slug (BR-023)', async () => {
        const user = await createUser('editor2');
        const token = makeJwt(app, user.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Slug stable title' } },
        });
        const originalSlug = create.json().article.slug;
        const update = await app.inject({
            method: 'PATCH',
            url: `/api/articles/${originalSlug}`,
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'Title changed but slug stays' } },
        });
        expect(update.statusCode).toBe(200);
        // BR-023: slug must not change even when title changes
        expect(update.json().article.slug).toBe(originalSlug);
        expect(update.json().article.title).toBe('Title changed but slug stays');
    });
});
// ─── DELETE /api/articles/:slug ─────────────────────────────────────────────
describe('DELETE /api/articles/:slug', () => {
    it('deletes the article (BR-035)', async () => {
        const user = await createUser('deleter1');
        const token = makeJwt(app, user.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${token}` },
            payload: { article: { title: 'To be deleted' } },
        });
        const { slug } = create.json().article;
        const del = await app.inject({
            method: 'DELETE',
            url: `/api/articles/${slug}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(del.statusCode).toBe(204);
        // Confirm deleted
        const get = await app.inject({ method: 'GET', url: `/api/articles/${slug}` });
        expect(get.statusCode).toBe(404);
    });
    it('returns 404 for non-owner (BR-034)', async () => {
        const owner = await createUser('owner2');
        const other = await createUser('other2');
        const ownerToken = makeJwt(app, owner.id);
        const otherToken = makeJwt(app, other.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${ownerToken}` },
            payload: { article: { title: 'Owner article 2' } },
        });
        const { slug } = create.json().article;
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/articles/${slug}`,
            headers: { authorization: `Bearer ${otherToken}` },
        });
        expect(res.statusCode).toBe(404);
    });
});
// ─── POST /api/articles/:slug/favorite ──────────────────────────────────────
describe('POST/DELETE /api/articles/:slug/favorite', () => {
    it('adds favourite and updates count (BR-036, BR-025)', async () => {
        const author = await createUser('author_fav');
        const reader = await createUser('reader_fav');
        const readerToken = makeJwt(app, reader.id);
        const authorToken = makeJwt(app, author.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${authorToken}` },
            payload: { article: { title: 'Favourable article' } },
        });
        const { slug } = create.json().article;
        const fav = await app.inject({
            method: 'POST',
            url: `/api/articles/${slug}/favorite`,
            headers: { authorization: `Bearer ${readerToken}` },
        });
        expect(fav.statusCode).toBe(200);
        expect(fav.json().article.favorited).toBe(true);
        expect(fav.json().article.favoritesCount).toBe(1); // BR-025: real count
    });
    it('removes favourite on DELETE (BR-036)', async () => {
        const author = await createUser('author_unfav');
        const reader = await createUser('reader_unfav');
        const readerToken = makeJwt(app, reader.id);
        const authorToken = makeJwt(app, author.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${authorToken}` },
            payload: { article: { title: 'Unfavourable article' } },
        });
        const { slug } = create.json().article;
        await app.inject({
            method: 'POST',
            url: `/api/articles/${slug}/favorite`,
            headers: { authorization: `Bearer ${readerToken}` },
        });
        const unfav = await app.inject({
            method: 'DELETE',
            url: `/api/articles/${slug}/favorite`,
            headers: { authorization: `Bearer ${readerToken}` },
        });
        expect(unfav.json().article.favorited).toBe(false);
        expect(unfav.json().article.favoritesCount).toBe(0);
    });
    it('author can favourite own article (BR-036)', async () => {
        const author = await createUser('self_fav');
        const authorToken = makeJwt(app, author.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${authorToken}` },
            payload: { article: { title: 'Self-fav article' } },
        });
        const { slug } = create.json().article;
        const res = await app.inject({
            method: 'POST',
            url: `/api/articles/${slug}/favorite`,
            headers: { authorization: `Bearer ${authorToken}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().article.favorited).toBe(true);
    });
    it('returns 401 when unauthenticated', async () => {
        const author = await createUser('unauth_fav');
        const authorToken = makeJwt(app, author.id);
        const create = await app.inject({
            method: 'POST',
            url: '/api/articles',
            headers: { authorization: `Bearer ${authorToken}` },
            payload: { article: { title: 'Unauth fav article' } },
        });
        const { slug } = create.json().article;
        const res = await app.inject({ method: 'POST', url: `/api/articles/${slug}/favorite` });
        expect(res.statusCode).toBe(401);
    });
});
