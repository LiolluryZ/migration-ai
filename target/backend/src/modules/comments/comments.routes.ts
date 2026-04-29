import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
// Import from barrel to ensure Article, UserStub and Comment associations are wired.
import { Comment } from './models/index';
import { Article } from '../articles/models/article.model';
import { UserStub } from '../articles/models/user.stub';
import { Follower } from '../accounts/models/follower.model';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the currently authenticated user (if any), or null. */
async function tryGetUser(
  request: FastifyRequest,
): Promise<{ id: number } | null> {
  try {
    await request.jwtVerify();
    return request.user as { id: number };
  } catch {
    return null;
  }
}

/**
 * Returns the set of author IDs that currentUser follows, intersected with
 * the provided candidateAuthorIds. BR-026.
 */
async function buildFollowingSet(
  currentUserId: number | null,
  candidateAuthorIds: number[],
): Promise<Set<number>> {
  if (!currentUserId || candidateAuthorIds.length === 0) return new Set();
  const rows = await Follower.findAll({
    where: { fromUserId: currentUserId, toUserId: { [Op.in]: candidateAuthorIds } },
    attributes: ['toUserId'],
  });
  return new Set(rows.map((r) => r.toUserId));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the standard comment JSON shape returned by all comment endpoints.
 *
 * Source: apps/comments/views.py — comment queryset shape rendered in template.
 * BR-039: content → body (mirrors BR-031 body/content pattern for articles).
 *
 * Response shape per RealWorld spec:
 *   { id, createdAt, updatedAt, body, author: { username, bio, image, following } }
 */
function formatComment(comment: Comment, followingSet: Set<number> = new Set()): object {
  const author = comment.author as UserStub | undefined;
  return {
    id: comment.id,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    // body maps to model.content (mirrors BR-031 body↔content naming for articles)
    body: comment.content,
    author: author
      ? {
          username: author.username,
          bio: author.bio ?? null,
          image: author.image ?? null,
          // BR-026: following — true if currentUser follows this comment’s author.
          following: author.id !== undefined ? followingSet.has(author.id) : false,
        }
      : null,
  };
}

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/articles/:slug/comments
 *
 * Source: apps/comments/views.py — comment_set rendered in article_detail_view
 *   and comment_create_view (HTMX partial).
 *
 * RBAC: public — anonymous access allowed.
 * BR-043: comments ordered anti-chronologically (most recent first).
 *
 * Response: { comments: [{ id, createdAt, updatedAt, body, author }] }
 */
async function listComments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug } = request.params as { slug: string };
  const currentUser = await tryGetUser(request);
  const currentUserId = currentUser?.id ?? null;

  const article = await Article.findOne({ where: { slug } });
  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  const comments = await Comment.findAll({
    where: { articleId: article.id },
    include: [{ model: UserStub, as: 'author' }],
    order: [['createdAt', 'DESC']], // BR-043: most recent first
  });

  const authorIds = comments
    .map((c) => (c.author as UserStub | undefined)?.id)
    .filter((id): id is number => id !== undefined);
  const followingSet = await buildFollowingSet(currentUserId, authorIds);

  reply.send({ comments: comments.map((c) => formatComment(c, followingSet)) });
}

/**
 * POST /api/articles/:slug/comments
 *
 * Source: apps/comments/views.py :: comment_create_view
 *   Creates a comment for the given article. Authenticated users only.
 *
 * RBAC: authenticated (BR-040).
 * BR-039: body (content) must be non-empty — 422 if missing or blank.
 * BR-040: @login_required → authenticate preHandler.
 *
 * Request body: { comment: { body: string } }
 * Response:     { comment: { id, createdAt, updatedAt, body, author } }  201
 */
async function createComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug } = request.params as { slug: string };
  const currentUser = request.user as { id: number };

  const body = (request.body as { comment?: { body?: string } })?.comment?.body?.trim();

  // BR-039: content is required and non-empty
  if (!body) {
    reply.code(422).send({ errors: { body: ["can't be blank"] } });
    return;
  }

  const article = await Article.findOne({ where: { slug } });
  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  const comment = await Comment.create({
    content: body,
    articleId: article.id!,
    authorId: currentUser.id,
  });

  // Reload with author association for the response
  const full = await Comment.findByPk(comment.id, {
    include: [{ model: UserStub, as: 'author' }],
  });

  // Author is the current user — self-following not supported → empty set.
  reply.code(201).send({ comment: formatComment(full!, new Set()) });
}

/**
 * DELETE /api/articles/:slug/comments/:id
 *
 * Source: apps/comments/views.py :: comment_delete_view
 *   Authorization: comment.author == user OR article.author == user, else 403.
 *
 * RBAC: authenticated (BR-040).
 * BR-041 CRITICAL: dual-owner check.
 *   Allow if: currentUser.id === comment.authorId  (comment author)
 *          OR currentUser.id === article.authorId  (article author)
 *   Else: return 403 Forbidden.
 *
 * Source pattern:
 *   if comment.author != request.user and article.author != request.user:
 *       return HttpResponseForbidden()
 */
async function deleteComment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { slug, id } = request.params as { slug: string; id: string };
  const currentUser = request.user as { id: number };

  const commentId = parseInt(id, 10);
  if (!Number.isFinite(commentId)) {
    reply.code(404).send({ errors: { id: ['Comment not found'] } });
    return;
  }

  const article = await Article.findOne({ where: { slug } });
  if (!article) {
    reply.code(404).send({ errors: { slug: ['Article not found'] } });
    return;
  }

  const comment = await Comment.findOne({ where: { id: commentId, articleId: article.id } });
  if (!comment) {
    reply.code(404).send({ errors: { id: ['Comment not found'] } });
    return;
  }

  // BR-041 CRITICAL: allow only if current user is comment author OR article author.
  // Source: comment.author != request.user and article.author != request.user → 403
  if (comment.authorId !== currentUser.id && article.authorId !== currentUser.id) {
    reply.code(403).send({ errors: { auth: ['Forbidden'] } });
    return;
  }

  await comment.destroy();
  reply.code(204).send();
}

// ─── Route registration ───────────────────────────────────────────────────────

/**
 * Registers all comment routes on the Fastify instance.
 *
 * Source: comments/urls.py :: urlpatterns
 *   path("article/<slug>/comment",            comment_create_view)
 *   path("article/<slug>/comment/<id>/delete", comment_delete_view)
 *
 * REST equivalents (RealWorld spec):
 *   GET    /api/articles/:slug/comments         → listComments
 *   POST   /api/articles/:slug/comments         → createComment
 *   DELETE /api/articles/:slug/comments/:id     → deleteComment
 */
export async function commentRoutes(fastify: FastifyInstance): Promise<void> {
  // GET — public (anonymous read, BR-043 anti-chrono order)
  fastify.get('/articles/:slug/comments', listComments);

  // POST — authenticated (BR-040)
  fastify.post(
    '/articles/:slug/comments',
    { preHandler: [fastify.authenticate] },
    createComment,
  );

  // DELETE — authenticated + dual-author check (BR-041)
  fastify.delete(
    '/articles/:slug/comments/:id',
    { preHandler: [fastify.authenticate] },
    deleteComment,
  );
}
