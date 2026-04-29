import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import articlesModule from '../modules/articles/articles.module';
import accountsModule from '../modules/accounts/accounts.module';
import commentsModule from '../modules/comments/comments.module';

// Root API router — registers all route modules under the /api prefix.
//
// Source: config/urls.py :: ROOT_URLCONF + include() patterns
//   path("", include("articles.urls"))  → articles routes  (Sprint 2) ✓
//   path("", include("accounts.urls"))  → accounts routes  (Sprint 3) ✓
//   path("", include("comments.urls"))  → comments routes  (Sprint 4)
//
// TM-001: Django urlpatterns → Fastify route registration (prefix /api)
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.register(healthRoutes, { prefix: '/api' });

  // Sprint 2: articles module
  fastify.register(articlesModule, { prefix: '/api' });

  // Sprint 3: accounts module (login, register, user, profiles)
  fastify.register(accountsModule, { prefix: '/api' });

  // Sprint 4: comments module
  fastify.register(commentsModule, { prefix: '/api' });
}
