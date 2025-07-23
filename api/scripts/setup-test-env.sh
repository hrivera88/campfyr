#!/bin/bash

# Setup test environment script
# This script creates the test database and runs migrations

set -e

echo "🔧 Setting up test environment..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL and try again."
    exit 1
fi

# Get current user
POSTGRES_USER=$(whoami)

# Create test database
echo "📊 Creating test database..."
psql -d postgres -c "DROP DATABASE IF EXISTS campfyr_test;"
psql -d postgres -c "CREATE DATABASE campfyr_test;"

# Set environment for migrations
export DATABASE_URL="postgresql://$POSTGRES_USER@localhost:5432/campfyr_test"

# Run migrations on test database
echo "🚀 Running migrations on test database..."
npx prisma migrate deploy

echo "✅ Test environment setup complete!"
echo "🧪 You can now run tests with: npm test"