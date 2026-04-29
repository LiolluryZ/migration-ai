import type { FastifyInstance } from 'fastify';
import { commentRoutes } from './comments.routes';

// Comments Fastify plugin.
//
// Source: apps/comments/urls.py :: urlpatterns
// Registers all comment routes under the /api prefix (added by the caller).
//
// NOT wrapped with fastify-plugin(fp): the prefix from the caller
// ({ prefix: '/api' }) is properly scoped to this module's routes.
// fastify.authenticate is available because authenticatePlugin IS fp-wrapped
// and decorates the root scope, visible to all child scopes.

export default async function commentsModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(commentRoutes);
}
