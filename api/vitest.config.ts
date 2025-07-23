import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        setupFiles: ['./tests/setup.ts'],
        pool: 'forks', // Run tests in separate processes for better isolation
        poolOptions: {
            forks: {
                singleFork: true // Run all tests in a single fork to prevent database conflicts
            }
        },
        testTimeout: 30000, // Increase timeout for database operations
        env: {
            DATABASE_URL: 'postgresql://halbertrivera@localhost:5432/campfyr_test',
            JWT_SECRET: 'test-jwt-secret',
            JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
            REDIS_URL: 'redis://localhost:6379',
            NODE_ENV: 'test'
        }
    }
});