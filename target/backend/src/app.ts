import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import authenticatePlugin from './plugins/authenticate';
import { registerRoutes } from './routes/index';
import { env } from './config/env';

// Fastify application factory.
//
// Translates Django MIDDLEWARE stack + INSTALLED_APPS plugin configuration.
// Source: config/settings.py :: MIDDLEWARE list (lines 47-56)

export async function buildApp() {
  const fastify = Fastify({
    logger: env.nodeEnv !== 'test',
  });

  // @fastify/helmet → SecurityMiddleware + XFrameOptionsMiddleware
  // Source: config/settings.py :: SecurityMiddleware, XFrameOptionsMiddleware
  // Sets: X-Frame-Options, X-Content-Type-Options, HSTS, etc.
  await fastify.register(helmet);

  // @fastify/cors → ALLOWED_HOSTS whitelist.
  // Source: config/settings.py :: ALLOWED_HOSTS (lines 26-27)
  //   DEBUG=True  → ["*"]   →  origin: true  (allow all in dev)
  //   production  → list    →  origin: env.allowedOrigins
  //
  // CSRF strategy: SameSite=Strict cookie replaces Django CsrfViewMiddleware.
  // Source: config/settings.py :: CsrfViewMiddleware
  // Rationale: SPA (Angular) does not POST HTML forms — classical CSRF token
  // pattern is replaced by SameSite=Strict + Origin header check (standard
  // defence for XHR/fetch-based clients).
  await fastify.register(cors, {
    origin:
      env.nodeEnv === 'development' || env.allowedOrigins.length === 0
        ? true
        : env.allowedOrigins,
    credentials: true,
    // SameSite=Strict is set on Set-Cookie responses in the accounts module.
  });

  // @fastify/cookie — required for SameSite=Strict cookie handling.
  // Accounts module will call reply.setCookie(..., { sameSite: 'strict' }).
  await fastify.register(cookie);

  // @fastify/jwt → Django session auth mechanism (redesign: session → JWT).
  // Source: config/settings.py :: SECRET_KEY → JWT_SECRET
  // TM-auth: Session/Cookie auth → JWT Bearer token (stateless)
  // BR-005: token validated by fastify.authenticate preHandler on protected routes.
  await fastify.register(jwt, {
    secret: env.jwtSecret,
  });

  // authenticate preHandler (stub) — validated token required on protected routes.
  // Source: config/settings.py :: LOGIN_URL = "/login" + @login_required (BR-005)
  await fastify.register(authenticatePlugin);

  // Register all API routes (/api prefix).
  // Source: config/urls.py :: urlpatterns with include()
  await registerRoutes(fastify);

  return fastify;
}
