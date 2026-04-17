"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const authenticate_1 = __importDefault(require("./plugins/authenticate"));
const index_1 = require("./routes/index");
const env_1 = require("./config/env");
// Fastify application factory.
//
// Translates Django MIDDLEWARE stack + INSTALLED_APPS plugin configuration.
// Source: config/settings.py :: MIDDLEWARE list (lines 47-56)
async function buildApp() {
    const fastify = (0, fastify_1.default)({
        logger: env_1.env.nodeEnv !== 'test',
    });
    // @fastify/helmet → SecurityMiddleware + XFrameOptionsMiddleware
    // Source: config/settings.py :: SecurityMiddleware, XFrameOptionsMiddleware
    // Sets: X-Frame-Options, X-Content-Type-Options, HSTS, etc.
    await fastify.register(helmet_1.default);
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
    await fastify.register(cors_1.default, {
        origin: env_1.env.nodeEnv === 'development' || env_1.env.allowedOrigins.length === 0
            ? true
            : env_1.env.allowedOrigins,
        credentials: true,
        // SameSite=Strict is set on Set-Cookie responses in the accounts module.
    });
    // @fastify/cookie — required for SameSite=Strict cookie handling.
    // Accounts module will call reply.setCookie(..., { sameSite: 'strict' }).
    await fastify.register(cookie_1.default);
    // @fastify/jwt → Django session auth mechanism (redesign: session → JWT).
    // Source: config/settings.py :: SECRET_KEY → JWT_SECRET
    // TM-auth: Session/Cookie auth → JWT Bearer token (stateless)
    // BR-005: token validated by fastify.authenticate preHandler on protected routes.
    await fastify.register(jwt_1.default, {
        secret: env_1.env.jwtSecret,
    });
    // authenticate preHandler (stub) — validated token required on protected routes.
    // Source: config/settings.py :: LOGIN_URL = "/login" + @login_required (BR-005)
    await fastify.register(authenticate_1.default);
    // Register all API routes (/api prefix).
    // Source: config/urls.py :: urlpatterns with include()
    await (0, index_1.registerRoutes)(fastify);
    return fastify;
}
