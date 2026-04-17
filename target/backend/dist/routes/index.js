"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const health_1 = require("./health");
const articles_module_1 = __importDefault(require("../modules/articles/articles.module"));
// Root API router — registers all route modules under the /api prefix.
//
// Source: config/urls.py :: ROOT_URLCONF + include() patterns
//   path("", include("articles.urls"))  → articles routes  (Sprint 2) ✓
//   path("", include("accounts.urls"))  → accounts routes  (Sprint 3)
//   path("", include("comments.urls"))  → comments routes  (Sprint 4)
//
// TM-001: Django urlpatterns → Fastify route registration (prefix /api)
async function registerRoutes(fastify) {
    fastify.register(health_1.healthRoutes, { prefix: '/api' });
    // Sprint 2: articles module
    fastify.register(articles_module_1.default, { prefix: '/api' });
    // TODO(sprint-3 / 18-traducteur accounts): register auth/profile routes
    //   fastify.register(accountRoutes, { prefix: '/api' });
    // TODO(sprint-4 / 18-traducteur comments): register comment routes
    //   fastify.register(commentRoutes, { prefix: '/api' });
}
