import dotenv from 'dotenv';
import { beforeEach, afterEach } from 'vitest';

// Load environment variables for testing
dotenv.config();

// Set test environment variables if not already set
// Use PostgreSQL test database - respect CI environment or use local default
if (!process.env.DATABASE_URL) {
  // Default for local development
  process.env.DATABASE_URL = 'postgresql://halbertrivera@localhost:5432/campfyr_test';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret';
}

if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
}

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

import { PrismaClient } from '../src/generated/prisma';

// Global Prisma instance for cleanup (created after env vars are set)
const globalPrisma = new PrismaClient();

console.log('🧪 Test environment configured:', {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET ? '***' : 'not set',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? '***' : 'not set'
});

// Note: Removed global beforeEach/afterEach cleanup as it was too aggressive
// Each test file should handle its own cleanup in beforeAll/afterAll hooks
// The randomized test data should prevent most conflicts