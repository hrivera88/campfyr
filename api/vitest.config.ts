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
        testTimeout: 30000 // Increase timeout for database operations
        // Environment variables handled by setup.ts to respect CI overrides
    }
});