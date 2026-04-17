import type { FastifyInstance } from 'fastify';
import { articleRoutes } from './articles.routes';

// Articles Fastify plugin.
//
// Source: apps/articles/urls.py :: urlpatterns
// Registers all article routes under the /api prefix (added by caller).
//
// NOT wrapped with fastify-plugin(fp): the prefix set by the caller
// ({ prefix: '/api' }) is properly scoped to this module's routes.
// fastify.authenticate is available because authenticatePlugin IS fp-wrapped
// and decorates the root scope, visible to all child scopes.

export default async function articlesModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(articleRoutes);
}
