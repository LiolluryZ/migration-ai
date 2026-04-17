"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
// JWT authentication preHandler stub.
//
// Source: config/settings.py :: LOGIN_URL = "/login" + @login_required decorator
// BR-005: IF NOT authenticated AND route.requires_auth THEN deny access.
//   Django behaviour: redirect 302 to /login.
//   REST equivalent (Fastify): 401 Unauthorized (SPA handles redirect client-side).
//
// STUB — token verification only. Full implementation (User model lookup,
// request.user population) will be added in the accounts module (Sprint 3).
async function authenticatePlugin(fastify) {
    fastify.decorate('authenticate', async function (request, reply) {
        try {
            // Verifies the Authorization: Bearer <token> header using JWT_SECRET.
            // If invalid or missing, jwtVerify throws and we return 401.
            await request.jwtVerify();
        }
        catch {
            // BR-005: unauthenticated access to protected route → deny.
            // 401 in REST = Django's redirect to LOGIN_URL for unauthenticated users.
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });
}
// fastify-plugin prevents encapsulation so fastify.authenticate is available
// in all route scopes registered after this plugin.
exports.default = (0, fastify_plugin_1.default)(authenticatePlugin, {
    name: 'authenticate',
    dependencies: ['@fastify/jwt'],
});
