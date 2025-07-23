-- Create test database if it doesn't exist
-- Run this with: psql -U postgres -c "\i scripts/setup-test-db.sql"

-- Connect to postgres database to create the test database
\c postgres;

-- Drop test database if it exists (for clean slate)
DROP DATABASE IF EXISTS campfyr_test;

-- Create test database
CREATE DATABASE campfyr_test;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE campfyr_test TO postgres;

\echo 'Test database campfyr_test created successfully!'