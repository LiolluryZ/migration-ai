// Fastify type augmentation for application-level decorators.
// These declarations keep TypeScript happy when using fastify.authenticate
// and other decorators added via fastify.decorate() in plugin files.
import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * JWT preHandler — validates the Authorization: Bearer <token> header.
     * Source: config/settings.py :: @login_required + LOGIN_URL (BR-005)
     * Full implementation: module accounts (18-traducteur, Sprint 3).
     */
    authenticate(
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ): Promise<void>;
  }
}
