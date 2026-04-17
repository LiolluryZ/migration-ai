import type { FastifyInstance } from 'fastify';
import { accountRoutes } from './accounts.routes';

// Accounts Fastify plugin.
//
// Source: apps/accounts/urls.py :: urlpatterns (login, register, settings,
//         logout, profile, follow)
//
// Registers all account routes under the /api prefix (added by the caller).
// NOT wrapped with fastify-plugin(fp): the prefix set by the caller
// ({ prefix: '/api' }) is properly scoped to this module's routes.
// fastify.authenticate is available because authenticatePlugin IS fp-wrapped
// and decorates the root scope, visible to all child scopes.

export default async function accountsModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(accountRoutes);
}
