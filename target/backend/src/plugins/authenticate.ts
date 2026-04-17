import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// JWT authentication preHandler.
//
// Source: config/settings.py :: LOGIN_URL = "/login" + @login_required decorator
// BR-005: IF NOT authenticated AND route.requires_auth THEN deny access.
//   Django behaviour: redirect 302 to /login.
//   REST equivalent (Fastify): 401 Unauthorized (SPA handles redirect client-side).
//
// JWT payload (accounts module, Sprint 3):
//   { id: number, username: string, email: string }
// After jwtVerify(), request.user contains these fields.
async function authenticatePlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        // Verifies the Authorization: Bearer <token> header using JWT_SECRET.
        // Attaches JWT payload to request.user: { id, username, email }.
        // If invalid or missing, jwtVerify throws and we return 401.
        await request.jwtVerify();
      } catch {
        // BR-005: unauthenticated access to protected route → deny.
        // 401 in REST = Django's redirect to LOGIN_URL for unauthenticated users.
        reply.code(401).send({ error: 'Unauthorized' });
      }
    },
  );
}

// fastify-plugin prevents encapsulation so fastify.authenticate is available
// in all route scopes registered after this plugin.
export default fp(authenticatePlugin, {
  name: 'authenticate',
  dependencies: ['@fastify/jwt'],
});
