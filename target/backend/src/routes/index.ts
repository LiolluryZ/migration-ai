import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';

// Root API router — registers all route modules under the /api prefix.
//
// Source: config/urls.py :: ROOT_URLCONF + include() patterns
//   path("", include("articles.urls"))  → articles routes  (Sprint 2)
//   path("", include("accounts.urls"))  → accounts routes  (Sprint 3)
//   path("", include("comments.urls"))  → comments routes  (Sprint 4)
//
// TM-001: Django urlpatterns → Fastify route registration (prefix /api)
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.register(healthRoutes, { prefix: '/api' });

  // TODO(sprint-2 / 18-traducteur articles): register article routes
  //   fastify.register(articleRoutes, { prefix: '/api' });

  // TODO(sprint-3 / 18-traducteur accounts): register auth/profile routes
  //   fastify.register(accountRoutes, { prefix: '/api' });

  // TODO(sprint-4 / 18-traducteur comments): register comment routes
  //   fastify.register(commentRoutes, { prefix: '/api' });
}
