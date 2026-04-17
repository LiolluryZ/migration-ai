"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const sequelize_config_1 = require("./config/sequelize.config");
// Application entry point.
// Source: config/wsgi.py + config/asgi.py (WSGI/ASGI Django entry points
//   are replaced by this single Node.js server start).
async function main() {
    const fastify = await (0, app_1.buildApp)();
    // Verify database connection before accepting traffic.
    // Source: config/settings.py :: DATABASES configuration — equivalent
    //   of Django raising ImproperlyConfigured on bad DB config at startup.
    try {
        await sequelize_config_1.sequelize.authenticate();
        fastify.log.info('Database connection established.');
    }
    catch (err) {
        fastify.log.error({ err }, 'Unable to connect to database. Aborting.');
        process.exit(1);
    }
    await fastify.listen({ port: env_1.env.port, host: '0.0.0.0' });
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
