"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = articlesModule;
const articles_routes_1 = require("./articles.routes");
// Articles Fastify plugin.
//
// Source: apps/articles/urls.py :: urlpatterns
// Registers all article routes under the /api prefix (added by caller).
//
// NOT wrapped with fastify-plugin(fp): the prefix set by the caller
// ({ prefix: '/api' }) is properly scoped to this module's routes.
// fastify.authenticate is available because authenticatePlugin IS fp-wrapped
// and decorates the root scope, visible to all child scopes.
async function articlesModule(fastify) {
    await fastify.register(articles_routes_1.articleRoutes);
}
