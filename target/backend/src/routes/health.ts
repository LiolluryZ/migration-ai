import type { FastifyInstance } from 'fastify';

// GET /api/health — liveness probe.
//
// No direct equivalent in config/urls.py (Django did not expose a health endpoint).
// Required by migration_plan.json :: validation_checkpoint:
//   "GET /api/health → 200 OK"
// This is bootstrap infrastructure, not business logic.
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });
}
