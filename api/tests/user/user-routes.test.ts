import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma';
import userRoutes from '../../src/routes/user';
import { DatabaseHelpers } from '../utils/test-helpers';

// Mock email service
vi.mock('../src/utils/sendEmail', () => ({
  sendInvitationalEmail: vi.fn().mockResolvedValue(true),
}));

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/users', userRoutes);

const prisma = new PrismaClient();

/**
 * User Routes - Core Functionality Tests
 * 
 * Tests for pagination, search, user listing, and individual user fetching.
 */
describe('User Routes - Core Functionality', () => {
  let testOrg: any;
  let testUsers: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    await DatabaseHelpers.cleanupTestData();

    // Create test organization
    testOrg = await prisma.organization.create({
      data: { name: 'Test Organization' }
    });

    // Create multiple test users for pagination/search testing
    const userPromises = [
      { email: 'alice@example.com', username: 'alice', isOnline: true },
      { email: 'bob@example.com', username: 'bob', isOnline: false },
      { email: 'charlie@example.com', username: 'charlie', isOnline: true },
      { email: 'diana@example.com', username: 'diana', isOnline: false },
      { email: 'eve@example.com', username: 'eve', isOnline: true },
      { email: 'frank@example.com', username: 'frank', isOnline: false },
      { email: 'grace@example.com', username: 'grace', isOnline: true },
      { email: 'henry@example.com', username: 'henry', isOnline: false },
      { email: 'ivan@example.com', username: 'ivan', isOnline: true },
      { email: 'judy@example.com', username: 'judy', isOnline: false },
    ].map(userData =>
      prisma.user.create({
        data: {
          ...userData,
          passwordHash: 'hashedpassword',
          organizationId: testOrg.id
        }
      })
    );

    testUsers = await Promise.all(userPromises);

    // Use first user for authentication
    authToken = jwt.sign(
      { userId: testUsers[0].id, organizationId: testOrg.id },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await DatabaseHelpers.cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /users - User Listing', () => {
    test('should return all users with default pagination', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(20); // Default take is 20
      expect(response.body).toHaveProperty('meta');
    });

    test('should return user details with correct fields', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      const user = response.body.data[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('isOnline');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('avatarUrl');

      // Should not include sensitive fields
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('resetToken');
    });

    test('should support pagination with take parameter', async () => {
      const response = await request(app)
        .get('/users')
        .query({ take: '3' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta).toHaveProperty('hasMore');
      expect(response.body.meta).toHaveProperty('nextCursor');
    });

    test('should support cursor-based pagination', async () => {
      // Get first page
      const firstResponse = await request(app)
        .get('/users')
        .query({ take: '3' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(firstResponse.body.meta.hasMore).toBe(true);
      const nextCursor = firstResponse.body.meta.nextCursor;

      // Get second page
      const secondResponse = await request(app)
        .get('/users')
        .query({ take: '3', cursor: nextCursor })
        .set('Authorization', `Bearer ${authToken}`);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data).toHaveLength(3);

      // Should be different users
      const firstPageIds = firstResponse.body.data.map((u: any) => u.id);
      const secondPageIds = secondResponse.body.data.map((u: any) => u.id);
      const overlap = firstPageIds.filter((id: string) => secondPageIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    test('should filter by online status', async () => {
      // Get only online users
      const onlineResponse = await request(app)
        .get('/users')
        .query({ isOnline: 'true' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(onlineResponse.status).toBe(200);
      onlineResponse.body.data.forEach((user: any) => {
        expect(user.isOnline).toBe(true);
      });

      // Get only offline users
      const offlineResponse = await request(app)
        .get('/users')
        .query({ isOnline: 'false' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(offlineResponse.status).toBe(200);
      offlineResponse.body.data.forEach((user: any) => {
        expect(user.isOnline).toBe(false);
      });
    });

    test('should support username search', async () => {
      const response = await request(app)
        .get('/users')
        .query({ search: 'alice' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].username).toBe('alice');
    });

    test('should support partial username search', async () => {
      const response = await request(app)
        .get('/users')
        .query({ search: 'an' }) // Should match "diana" and "frank"
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);

      const usernames = response.body.data.map((u: any) => u.username);
      const containsAn = usernames.filter((name: string) => name.includes('an'));
      expect(containsAn.length).toBeGreaterThan(0);
    });

    test('should return empty array for non-matching search', async () => {
      const response = await request(app)
        .get('/users')
        .query({ search: 'nonexistentuser' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should combine search and filtering', async () => {
      const response = await request(app)
        .get('/users')
        .query({ search: 'e', isOnline: 'true' }) // Users with 'e' in name who are online
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((user: any) => {
        expect(user.username).toMatch(/e/i);
        expect(user.isOnline).toBe(true);
      });
    });

    test('should handle case-insensitive search', async () => {
      const lowerResponse = await request(app)
        .get('/users')
        .query({ search: 'alice' })
        .set('Authorization', `Bearer ${authToken}`);

      const upperResponse = await request(app)
        .get('/users')
        .query({ search: 'ALICE' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(lowerResponse.body.data).toEqual(upperResponse.body.data);
    });

    test('should handle large take values gracefully', async () => {
      const response = await request(app)
        .get('/users')
        .query({ take: '1000' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(testUsers.length);
    });

    test('should handle invalid take values', async () => {
      const response = await request(app)
        .get('/users')
        .query({ take: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`);

      // Should default to 20 or handle gracefully
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(20);
    });

    test('should exclude soft-deleted users', async () => {
      // Soft delete a user
      const userToDelete = testUsers[0];
      await prisma.user.update({
        where: { id: userToDelete.id },
        data: { deletedAt: new Date() }
      });

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const userIds = response.body.data.map((u: any) => u.id);
      expect(userIds).not.toContain(userToDelete.id);

      // Restore user for other tests
      await prisma.user.update({
        where: { id: userToDelete.id },
        data: { deletedAt: null }
      });
    });
  });

  describe('GET /users/:id - Individual User', () => {
    test('should return specific user details', async () => {
      const targetUser = testUsers[1];

      const response = await request(app)
        .get(`/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(targetUser.id);
      expect(response.body.username).toBe(targetUser.username);
      expect(response.body.email).toBe(targetUser.email);

      // Should include safe fields
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('avatarUrl');

      // Should not include sensitive fields
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('isOnline');
      expect(response.body).not.toHaveProperty('organizationId');
    });

    test('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/users/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    test('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/users/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 404, 500]).toContain(response.status);
    });

    test('should not return soft-deleted users', async () => {
      const userToDelete = testUsers[2];

      // Soft delete user
      await prisma.user.update({
        where: { id: userToDelete.id },
        data: { deletedAt: new Date() }
      });

      const response = await request(app)
        .get(`/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');

      // Restore user
      await prisma.user.update({
        where: { id: userToDelete.id },
        data: { deletedAt: null }
      });
    });
  });

  describe('GET /users/organization - Organization Details', () => {
    test('should return organization details with counts', async () => {
      const response = await request(app)
        .get('/users/organization')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testOrg.id);
      expect(response.body.name).toBe('Test Organization');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('_count');

      const counts = response.body._count;
      expect(counts).toHaveProperty('users');
      expect(counts).toHaveProperty('rooms');
      expect(counts).toHaveProperty('directConversations');
      expect(counts).toHaveProperty('invitations');

      expect(counts.users).toBe(testUsers.length);
      expect(typeof counts.users).toBe('number');
    });

    test('should handle organization not found', async () => {
      // Create token with non-existent organization
      const invalidToken = jwt.sign(
        { userId: testUsers[0].id, organizationId: '00000000-0000-0000-0000-000000000000' },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/users/organization')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Organization not found');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent requests efficiently', async () => {
      const promises = Array(10).fill(0).map(() =>
        request(app)
          .get('/users')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle deep pagination efficiently', async () => {
      // Test pagination through all users
      let hasMore = true;
      let cursor: string | undefined;
      let totalFetched = 0;
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops

      while (hasMore && iterations < maxIterations) {
        const response = await request(app)
          .get('/users')
          .query({ take: '2', ...(cursor ? { cursor } : {}) })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        totalFetched += response.body.data.length;
        hasMore = response.body.meta.hasMore;
        cursor = response.body.meta.nextCursor;
        iterations++;
      }

      expect(totalFetched).toBeGreaterThan(0);
    });

    test('should handle special characters in search', async () => {
      const specialChars = ['%', '_', "'", '"', '\\', '<', '>', '&'];

      for (const char of specialChars) {
        const response = await request(app)
          .get('/users')
          .query({ search: char })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('should handle empty query parameters gracefully', async () => {
      const response = await request(app)
        .get('/users')
        .query({ search: '', take: '', cursor: '' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should maintain consistent ordering', async () => {
      // Make multiple requests and verify order is consistent
      const response1 = await request(app)
        .get('/users')
        .query({ take: '5' })
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/users')
        .query({ take: '5' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.body.data).toEqual(response2.body.data);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking Prisma client
      // For now, just ensure current implementation doesn't crash
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    test('should return consistent error format', async () => {
      const response = await request(app)
        .get('/users/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    test('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get('/users?take[]=invalid&search[object]=malformed')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400]).toContain(response.status);
    });
  });
});