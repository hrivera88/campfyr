import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma';
import userRoutes from '../../src/routes/user';
import { DatabaseHelpers } from '../utils/test-helpers';

// Mock email service to prevent actual emails during tests
vi.mock('../../src/utils/sendEmail', () => ({
  sendInvitationalEmail: vi.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/users', userRoutes);

const prisma = new PrismaClient();

/**
 * User Routes Security Tests
 * 
 * Tests authentication, authorization, and organization isolation
 * for all user management endpoints.
 */
describe('User Routes - Security & Authorization', () => {
  let testOrg1: any;
  let testOrg2: any;
  let testUser1: any; // User in org1
  let testUser2: any; // User in org2
  let validToken1: string; // Token for user1
  let validToken2: string; // Token for user2
  let invalidToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    await DatabaseHelpers.cleanupTestData();

    // Create test organizations
    testOrg1 = await prisma.organization.create({
      data: { name: 'Test Organization 1' }
    });

    testOrg2 = await prisma.organization.create({
      data: { name: 'Test Organization 2' }
    });

    // Create test users in different organizations
    testUser1 = await prisma.user.create({
      data: {
        email: 'user1@test.com',
        username: 'testuser1',
        passwordHash: 'hashedpassword1',
        organizationId: testOrg1.id
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        email: 'user2@test.com',
        username: 'testuser2',
        passwordHash: 'hashedpassword2',
        organizationId: testOrg2.id
      }
    });

    // Generate tokens
    const JWT_SECRET = process.env.JWT_SECRET!;
    validToken1 = jwt.sign(
      { userId: testUser1.id, organizationId: testOrg1.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    validToken2 = jwt.sign(
      { userId: testUser2.id, organizationId: testOrg2.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    invalidToken = 'invalid.jwt.token';
    expiredToken = jwt.sign(
      { userId: testUser1.id, organizationId: testOrg1.id },
      JWT_SECRET,
      { expiresIn: '-1h' } // Already expired
    );
  });

  afterAll(async () => {
    await DatabaseHelpers.cleanupTestData();
    await prisma.$disconnect();
  });

  describe('Authentication Tests', () => {
    const getProtectedEndpoints = () => [
      { method: 'get', path: '/users' },
      { method: 'get', path: '/users/organization' },
      { method: 'post', path: '/users/invite' },
      { method: 'get', path: '/users/invitations' },
      { method: 'post', path: '/users/invitations/fake-id/resend' },
      { method: 'get', path: `/users/${testUser1?.id || 'fake-id'}` },
    ];

    getProtectedEndpoints().forEach(({ method, path }) => {
      test(`${method.toUpperCase()} ${path} should require authentication`, async () => {
        const response = await request(app)[method as keyof typeof request](path);
        expect(response.status).toBe(401);
        // auth middleware returns 401 with no body when no auth header
      });

      test(`${method.toUpperCase()} ${path} should reject invalid token`, async () => {
        const response = await request(app)
        [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${invalidToken}`);
        expect(response.status).toBe(403);
      });

      test(`${method.toUpperCase()} ${path} should reject expired token`, async () => {
        const response = await request(app)
        [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${expiredToken}`);
        expect(response.status).toBe(403);
      });

      test(`${method.toUpperCase()} ${path} should accept valid token`, async () => {
        const response = await request(app)
        [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${validToken1}`)
          .send({ email: 'test@example.com' }); // For invite endpoint

        // Should not be 401 or 403 (auth errors)
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });
    });

    test('Missing Authorization header should return 401', async () => {
      const response = await request(app).get('/users');
      expect(response.status).toBe(401);
      // Middleware returns sendStatus(401) with no body
    });

    test('Malformed Authorization header should return 401', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', 'InvalidFormat');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token missing');
    });

    test('Empty Bearer token should return 401', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer ');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token missing');
    });
  });

  describe('Organization Isolation Tests', () => {
    let user1InOrg2: any;
    let invitationInOrg1: any;
    let invitationInOrg2: any;

    beforeEach(async () => {
      // Create additional user in org2 for testing
      user1InOrg2 = await prisma.user.create({
        data: {
          email: 'user1inorg2@test.com',
          username: 'user1inorg2',
          passwordHash: 'hashedpassword',
          organizationId: testOrg2.id
        }
      });

      // Create test invitations in both organizations
      invitationInOrg1 = await prisma.invitation.create({
        data: {
          email: 'invite1@test.com',
          invitedById: testUser1.id,
          organizationId: testOrg1.id,
          token: 'token1',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      invitationInOrg2 = await prisma.invitation.create({
        data: {
          email: 'invite2@test.com',
          invitedById: testUser2.id,
          organizationId: testOrg2.id,
          token: 'token2',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    });

    afterEach(async () => {
      // Cleanup test data
      await prisma.invitation.deleteMany({
        where: {
          OR: [
            { organizationId: testOrg1.id },
            { organizationId: testOrg2.id }
          ]
        }
      });
      await prisma.user.deleteMany({
        where: { id: user1InOrg2.id }
      });
    });

    test('GET /users should only return users from same organization', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should only contain users from testOrg1
      const userIds = response.body.data.map((user: any) => user.id);
      expect(userIds).toContain(testUser1.id);
      expect(userIds).not.toContain(testUser2.id);
      expect(userIds).not.toContain(user1InOrg2.id);
    });

    test('GET /users/:id should not return users from other organizations', async () => {
      // User1 trying to access User2 (different org)
      const response = await request(app)
        .get(`/users/${testUser2.id}`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    test('GET /users/:id should return users from same organization', async () => {
      const response = await request(app)
        .get(`/users/${testUser1.id}`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUser1.id);
    });

    test('GET /users/organization should return correct organization', async () => {
      const response1 = await request(app)
        .get('/users/organization')
        .set('Authorization', `Bearer ${validToken1}`);

      const response2 = await request(app)
        .get('/users/organization')
        .set('Authorization', `Bearer ${validToken2}`);

      expect(response1.status).toBe(200);
      expect(response1.body.id).toBe(testOrg1.id);
      expect(response1.body.name).toBe('Test Organization 1');

      expect(response2.status).toBe(200);
      expect(response2.body.id).toBe(testOrg2.id);
      expect(response2.body.name).toBe('Test Organization 2');
    });

    test('GET /users/invitations should only return invitations from same organization', async () => {
      const response = await request(app)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const invitationIds = response.body.data.map((inv: any) => inv.id);
      expect(invitationIds).toContain(invitationInOrg1.id);
      expect(invitationIds).not.toContain(invitationInOrg2.id);
    });

    test('POST /users/invitations/:id/resend should not allow cross-organization access', async () => {
      // User1 trying to resend invitation from Org2
      const response = await request(app)
        .post(`/users/invitations/${invitationInOrg2.id}/resend`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invitation not found');
    });

    test('POST /users/invitations/:id/resend should work for same organization', async () => {
      const response = await request(app)
        .post(`/users/invitations/${invitationInOrg1.id}/resend`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Input Validation & Security', () => {
    test('POST /users/invite should reject missing email', async () => {
      const response = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });

    test('POST /users/invite should handle malformed email gracefully', async () => {
      const response = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({ email: 'not-an-email' });

      // Should not crash, but email service might reject it
      expect([200, 400, 500]).toContain(response.status);
    });

    test('GET /users should handle SQL injection attempts', async () => {
      const maliciousSearch = "'; DROP TABLE users; --";
      const response = await request(app)
        .get('/users')
        .query({ search: maliciousSearch })
        .set('Authorization', `Bearer ${validToken1}`);

      // Should not crash and return safe results
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('GET /users should handle XSS attempts in search', async () => {
      const xssAttempt = '<script>alert("xss")</script>';
      const response = await request(app)
        .get('/users')
        .query({ search: xssAttempt })
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('GET /users/:id should handle invalid UUIDs', async () => {
      const response = await request(app)
        .get('/users/invalid-uuid')
        .set('Authorization', `Bearer ${validToken1}`);

      expect([400, 404, 500]).toContain(response.status);
    });

    test('POST /users/invitations/:id/resend should handle invalid UUIDs', async () => {
      const response = await request(app)
        .post('/users/invitations/invalid-uuid/resend')
        .set('Authorization', `Bearer ${validToken1}`);

      expect([400, 404, 500]).toContain(response.status);
    });
  });

  describe('Rate Limiting & Performance Security', () => {
    test('Multiple rapid requests should not cause server errors', async () => {
      const promises = Array(10).fill(0).map(() =>
        request(app)
          .get('/users')
          .set('Authorization', `Bearer ${validToken1}`)
      );

      const responses = await Promise.all(promises);

      // All requests should complete without server errors
      responses.forEach(response => {
        expect(response.status).not.toBe(500);
      });
    });

    test('Large pagination requests should be handled safely', async () => {
      const response = await request(app)
        .get('/users')
        .query({ take: '999999' }) // Very large take value
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should limit results even with large take value
    });
  });

  describe('Error Response Security', () => {
    test('Error responses should not leak sensitive information', async () => {
      const response = await request(app)
        .get('/users/nonexistent-id')
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');

      // Should not contain database details, stack traces, etc.
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('query');
      expect(response.body).not.toHaveProperty('sql');
    });

    test('Authentication errors should be consistent', async () => {
      const endpoints = ['/users', '/users/organization', '/users/invitations'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(401);
        // Note: Missing auth header returns 401 with no body
        // Only malformed tokens return error objects
      }
    });
  });
});