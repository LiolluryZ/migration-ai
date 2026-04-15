import type { Config } from 'jest';

// Jest configuration for Fastify/TypeScript backend.
// Source: config/settings.py :: USE_FAST_HASHER test shortcut →
//   equivalent is PBKDF2_ITERATIONS=1 env var (set in test environment).
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-do-not-use-in-production';
process.env.PBKDF2_ITERATIONS = process.env.PBKDF2_ITERATIONS ?? '1';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
};

export default config;
