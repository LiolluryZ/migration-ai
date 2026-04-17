import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Op, fn, col, literal } from 'sequelize';
import { UniqueConstraintError } from 'sequelize';
// Import from barrel to ensure associations are wired before first query.
import { Article, Tag, ArticleTag, Favorite, UserStub } from './models';
import { parseSequelizeError } from '../../shared/errors';

// ARTICLES_PER_PAGE — translates apps/articles/views.py :: ARTICLES_PER_PAGE = 10
// BR-028: 10 articles per page, ordered by date descending.
// The inconsistency note (agents 05/15) is preserved: both articles
// and accounts use the same value (10), factored here as a shared constant.
export const ARTICLES_PER_PAGE = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds the standard "article" JSON shape returned by all article endpoints.
 *
 * Source: apps/articles/models.py :: ArticleQuerySet.with_favorites()
 *   with_favorites annotates each article with num_favorites (COUNT) and
 *   is_favorite (EXISTS).  Here we compute them from pre-loaded associations.
 *
 * BR-025: favoritesCount = real-time COUNT (no cache on counter).
 * BR-031: summary → description, content → body in API response.
 */
function formatArticle(
  article: Article,
  currentUserId: number | null,
): object {
  const tagList = (article.tags ?? []).map((t: Tag) => t.name).sort();
  const favoritesCount = (article.favoriteRecords ?? []).length;
  const favorited = currentUserId !== null
    ? (article.favoriteRecords ?? []).some((f: Favorite) => f.userId === currentUserId)
    : false;
  const author = article.author as UserStub | undefined;

  return {
    slug: article.slug,
    title: article.title,
    description: article.summary,   // BR-031: summary → description
    body: article.content,           // BR-031: content → body
    tagList,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    favorited,
    favoritesCount,
    author: author
      ? {
          username: author.username,
          bio: author.bio ?? null,
          image: author.image ?? null,
          // BR-026 (following): deferred to Sprint 3 (accounts module).
          // The accounts module will add a UserFollow table and resolve this.
          following: false,
        }
      : null,
  };
}

/** Full include spec used for article queries — author + tags + favorites. */
function articleIncludes(currentUserId: number | null) {
  return [
    { model: UserStub, as: 'author' },
    { model: Tag, as: 'tags', through: { attributes: [] } },
    {
      model: Favorite,
      as: 'favoriteRecords',
      ...(currentUserId !== null ? {} : { where: undefined }),
    },
  ];
}

/** Extract optional authenticated user from the JWT (does not throw). */
async function tryGetUser(request: FastifyRequest): Promise<{ id: number } | null> {
  try {
    await request.jwtVerify();
    return request.user as { id: number };
  } catch {
    return null;
  }
}

// ─── Route handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/articles
 *
 * Source: apps/articles/views.py :: home_view / tag_view / _build_feed
 *
 * BR-026: supports tabs global / following / tag via query params.
 * BR-028: paginated, 10 articles per page, ordered by date DESC.
 * BR-034 note: feed=following without auth returns empty (API convention —
 *   legacy Django redirected to /login; the SPA handles this on the client).
 */
async function listArticles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const query = request.query as {
    feed?: string;
    tag?: string;
    author?: string;
    favorited?: string;
    page?: string;
  };

  const currentUser = await tryGetUser(request);
  const currentUserId = currentUser?.id ?? null;

  let page = parseInt(query.page ?? '1', 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  const offset = (page - 1) * ARTICLES_PER_PAGE;

  const where: Record<string, unknown> = {};
  let authorFilter: number[] | null = null;

  // BR-026: following tab — only articles from users the current user follows.
  // Following data deferred to Sprint 3; for now returns empty set when requested.
  if (query.feed === 'following') {
    if (!currentUser) {
      // API convention: unauthenticated → 401 (client should redirect to /login)
      reply.code(401).send({ errors: { auth: ['Authentication required'] } });
      return;
    }
    // Sprint 3: replace with actual followed-user IDs from UserFollow table.
    authorFilter = [];
  }

  // Filter by tag
  if (query.tag) {
    const tag = await Tag.findOne({ where: { name: query.tag.toLowerCase() } });
    if (!tag) {
      reply.send({ articles: [], articlesCount: 0 });
      return;
    }
    const articleIds = await ArticleTag.findAll({ where: { tagId: tag.id, contentTypeId: 9 } });
    where['id'] = { [Op.in]: articleIds.map((at) => at.objectId) };
  }

  // Filter by author username
  if (query.author) {
    const authorUser = await UserStub.findOne({ where: { username: query.author } });
    if (!authorUser) {
      reply.send({ articles: [], articlesCount: 0 });
      return;
    }
    where['authorId'] = authorUser.id;
  }

  // Filter by favorited username
  if (query.favorited) {
    const favUser = await UserStub.findOne({ where: { username: query.favorited } });
    if (!favUser) {
      reply.send({ articles: [], articlesCount: 0 });
      return;
    }
    const favArticleIds = await Favorite.findAll({ where: { userId: favUser.id } });
    const ids = favArticleIds.map((f) => f.articleId);
    if (where['id']) {
      // intersect with existing id filter
      const existingIds = (where['id'] as { [Op.in]: number[] })[Op.in];
      where['id'] = { [Op.in]: ids.filter((id) => existingIds.includes(id)) };
    } else {
      where['id'] = { [Op.in]: ids };
    }
  }

  // Apply following author filter
  if (authorFilter !== null) {
    where['authorId'] = { [Op.in]: authorFilter };
  }

  const total = await Article.count({ where });
  const rows = await Article.findAll({
    where,
    include: articleIncludes(currentUserId) as never,
    order: [['createdAt', 'DESC']], // BR-028: ordered by date DESC
    limit: ARTICLES_PER_PAGE,
    offset,
  });

  reply.send({
    articles: rows.map((a) => formatArticle(a, currentUserId)),
    articlesCount: total,
  });
}

/**
 * GET /api/articles/:slug
 *
 * Source: apps/articles/views.py :: article_detail_view
 * BR-030: non-existent article → 404 with slug in response.
 */
async function getArticle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug } = request.params as { slug: string };
  const currentUser = await tryGetUser(request);
  const currentUserId = currentUser?.id ?? null;

  const article = await Article.findOne({
    where: { slug },
    include: articleIncludes(currentUserId) as never,
  });

  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  reply.send({ article: formatArticle(article, currentUserId) });
}

/**
 * POST /api/articles
 *
 * Source: apps/articles/views.py :: article_create_view
 * BR-033: auth required, author = request.user.
 * BR-022: title required, unique (UniqueConstraintError → 422).
 * BR-023: slug generated from title at creation only.
 * BR-032: tags cleared then re-added each save.
 * BR-026: tags normalised to lowercase.
 */
async function createArticle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.user as { id: number };
  const body = request.body as {
    article?: {
      title?: string;
      description?: string;
      body?: string;
      tagList?: string[];
    };
  };

  const data = body?.article;
  if (!data?.title?.trim()) {
    reply.code(422).send({ errors: { title: ['Title is required'] } });
    return;
  }
  if (data.title.length > 150) {
    reply.code(422).send({ errors: { title: ['Title must be 150 characters or fewer'] } });
    return;
  }

  try {
    const article = await Article.create({
      title: data.title.trim(),
      summary: data.description?.trim() ?? '',   // BR-031
      content: data.body?.trim() ?? '',           // BR-031
      authorId: currentUser.id,
      // slug is set by the beforeCreate hook (BR-023)
    });

    // BR-032 + BR-026: set tags (clear implicit since this is a new record)
    await syncTags(article, data.tagList ?? []);

    const full = await Article.findOne({
      where: { id: article.id },
      include: articleIncludes(currentUser.id) as never,
    });

    reply.code(201).send({ article: formatArticle(full!, currentUser.id) });
  } catch (err) {
    const field = parseSequelizeError(err);
    if (field === 'title') {
      reply.code(422).send({ errors: { title: ['Title already in use'] } });
    } else if (field) {
      reply.code(422).send({ errors: { [field]: ['must be unique'] } });
    } else {
      throw err;
    }
  }
}

/**
 * PATCH /api/articles/:slug
 *
 * Source: apps/articles/views.py :: article_edit_view
 * BR-023 CRITICAL: slug MUST NOT be changed after creation.
 *   PATCH requests that include a 'slug' field are rejected with 422.
 * BR-034: non-owner → 404 (matches get_object_or_404(Article, slug=slug, author=request.user)).
 * BR-031: description → summary, body → content.
 * BR-032: tags cleared then re-added.
 */
async function updateArticle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug } = request.params as { slug: string };
  const currentUser = request.user as { id: number };
  const body = request.body as {
    article?: {
      slug?: string;
      title?: string;
      description?: string;
      body?: string;
      tagList?: string[];
    };
  };

  // BR-023 CRITICAL: reject slug modification attempts
  if (body?.article?.slug !== undefined) {
    reply.code(422).send({ errors: { slug: ['must not be modified'] } });
    return;
  }

  // BR-034: non-owner → 404 (same as get_object_or_404(Article, slug=slug, author=request.user))
  const article = await Article.findOne({ where: { slug, authorId: currentUser.id } });
  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  const data = body?.article ?? {};

  if (data.title !== undefined) {
    if (!data.title.trim()) {
      reply.code(422).send({ errors: { title: ['Title is required'] } });
      return;
    }
    if (data.title.length > 150) {
      reply.code(422).send({ errors: { title: ['Title must be 150 characters or fewer'] } });
      return;
    }
    article.title = data.title.trim();
  }
  if (data.description !== undefined) article.summary = data.description.trim(); // BR-031
  if (data.body !== undefined) article.content = data.body.trim();               // BR-031

  try {
    await article.save();
  } catch (err) {
    const field = parseSequelizeError(err);
    if (field === 'title') {
      reply.code(422).send({ errors: { title: ['Title already in use'] } });
      return;
    }
    throw err;
  }

  // BR-032: tags cleared and re-added if tagList is present
  if (data.tagList !== undefined) {
    await syncTags(article, data.tagList);
  }

  const full = await Article.findOne({
    where: { id: article.id },
    include: articleIncludes(currentUser.id) as never,
  });

  reply.send({ article: formatArticle(full!, currentUser.id) });
}

/**
 * DELETE /api/articles/:slug
 *
 * Source: apps/articles/views.py :: article_delete_view
 * BR-035: auth + owner check. CASCADE on comments (set up in comments module Sprint 4).
 * BR-034: non-owner → 404 (get_object_or_404 pattern).
 */
async function deleteArticle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug } = request.params as { slug: string };
  const currentUser = request.user as { id: number };

  // BR-034: non-owner → 404
  const article = await Article.findOne({ where: { slug, authorId: currentUser.id } });
  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  // BR-035: delete article — tags and favorites cascade via DB FK (ON DELETE CASCADE)
  await article.destroy();

  reply.code(204).send();
}

/**
 * POST /api/articles/:slug/favorite
 * DELETE /api/articles/:slug/favorite
 *
 * Source: apps/articles/views.py :: article_favorite_view (toggle POST)
 * BR-036: toggle — add if not favorited, remove if already favorited.
 *    Author can favourite their own article (no restriction in legacy).
 * BR-025: favoritesCount recalculated from DB — no cache on counter.
 */
async function toggleFavorite(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug } = request.params as { slug: string };
  const currentUser = request.user as { id: number };

  const article = await Article.findOne({ where: { slug } });
  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  const existing = await Favorite.findOne({
    where: { userId: currentUser.id, articleId: article.id },
  });

  if (request.method === 'DELETE') {
    if (existing) await existing.destroy();
  } else {
    // POST — add if not already favorited (toggle: idempotent)
    if (!existing) {
      await Favorite.create({ userId: currentUser.id, articleId: article.id });
    }
  }

  // BR-025: re-query with fresh favorites count (no cache)
  const full = await Article.findOne({
    where: { id: article.id },
    include: articleIncludes(currentUser.id) as never,
  });

  reply.send({ article: formatArticle(full!, currentUser.id) });
}

// ─── Tag sync helper ─────────────────────────────────────────────────────────

/**
 * Sync article tags.
 *
 * Source: apps/articles/views.py :: _save_article_form
 *   article.tags.clear()
 *   for tag_name in tag_string.split(","):
 *       article.tags.add(tag_name)
 *
 * BR-032: clear then re-add.
 * BR-026: normalise to lowercase (taggit behaviour).
 */
async function syncTags(article: Article, rawTags: string[]): Promise<void> {
  // Clear existing tags (BR-032)
  await ArticleTag.destroy({ where: { objectId: article.id, contentTypeId: 9 } });

  for (const raw of rawTags) {
    const name = raw.trim().toLowerCase(); // BR-026: lowercase normalisation
    if (!name) continue;
    const [tag] = await Tag.findOrCreate({ where: { name }, defaults: { name, slug: name } });
    await ArticleTag.findOrCreate({
      where: { objectId: article.id, tagId: tag.id, contentTypeId: 9 },
    });
  }
}

// ─── Route registration ──────────────────────────────────────────────────────

export async function articleRoutes(fastify: FastifyInstance): Promise<void> {
  // Sync tables (dev / test only — production should use migrations)
  await Article.sync({ alter: false });
  await Tag.sync({ alter: false });
  await ArticleTag.sync({ alter: false });
  await Favorite.sync({ alter: false });
  await UserStub.sync({ alter: false });

  // GET /api/articles — list with optional filters (no auth required)
  fastify.get('/articles', listArticles);

  // GET /api/articles/:slug — detail (no auth required)
  fastify.get('/articles/:slug', getArticle);

  // POST /api/articles — create (auth required)
  fastify.post('/articles', { preHandler: [fastify.authenticate] }, createArticle);

  // PATCH /api/articles/:slug — update (auth required)
  fastify.patch('/articles/:slug', { preHandler: [fastify.authenticate] }, updateArticle);

  // DELETE /api/articles/:slug — delete (auth required)
  fastify.delete('/articles/:slug', { preHandler: [fastify.authenticate] }, deleteArticle);

  // POST /api/articles/:slug/favorite — add favourite (auth required)
  fastify.post('/articles/:slug/favorite', { preHandler: [fastify.authenticate] }, toggleFavorite);

  // DELETE /api/articles/:slug/favorite — remove favourite (auth required)
  fastify.delete('/articles/:slug/favorite', { preHandler: [fastify.authenticate] }, toggleFavorite);

  // GET /api/tags — distinct tag list for sidebar (no auth required).
  // Source: apps/articles/ — tags are displayed in the home sidebar (BR-026).
  // No dedicated view in Django (tags came from Article queryset); this endpoint
  // exposes Tag.findAll() sorted alphabetically so the Angular sidebar can load them.
  fastify.get('/tags', async (_request, reply) => {
    const tags = await Tag.findAll({ order: [['name', 'ASC']] });
    reply.send({ tags: tags.map((t) => t.name) });
  });
}
