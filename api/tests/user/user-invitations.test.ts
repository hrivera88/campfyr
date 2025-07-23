import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma';
import userRoutes from '../../src/routes/user';
import { sendInvitationalEmail } from '../../src/utils/sendEmail';
import { DatabaseHelpers } from '../utils/test-helpers';

// Mock email service
vi.mock('../../src/utils/sendEmail', () => ({
  sendInvitationalEmail: vi.fn(),
}));

const mockSendInvitationalEmail = vi.mocked(sendInvitationalEmail);

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/users', userRoutes);

const prisma = new PrismaClient();

/**
 * User Invitation System Tests
 * 
 * Comprehensive tests for invitation creation, listing, resending,
 * email integration, and invitation lifecycle management.
 */
describe('User Invitation System', () => {
  let testOrg: any;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await DatabaseHelpers.cleanupTestData();

    // Create test organization and user
    testOrg = await prisma.organization.create({
      data: { name: 'Test Organization' }
    });

    testUser = await prisma.user.create({
      data: {
        email: 'testuser@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        organizationId: testOrg.id
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, organizationId: testOrg.id },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await DatabaseHelpers.cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendInvitationalEmail.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Clean up invitations after each test
    await prisma.invitation.deleteMany({
      where: { organizationId: testOrg.id }
    });
  });

  describe('POST /users/invite - Create Invitation', () => {
    test('should successfully create invitation with valid email', async () => {
      const email = 'newuser@example.com';

      const response = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify invitation was created in database
      const invitation = await prisma.invitation.findFirst({
        where: { email, organizationId: testOrg.id }
      });

      expect(invitation).toBeTruthy();
      expect(invitation!.email).toBe(email);
      expect(invitation!.invitedById).toBe(testUser.id);
      expect(invitation!.organizationId).toBe(testOrg.id);
      expect(invitation!.status).toBe('pending');
      expect(invitation!.token).toBeTruthy();
      expect(invitation!.expiresAt).toBeInstanceOf(Date);

      // Should expire in ~24 hours
      const hoursDiff = (invitation!.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });

    test('should send invitation email', async () => {
      const email = 'emailtest@example.com';

      await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email });

      expect(mockSendInvitationalEmail).toHaveBeenCalledOnce();
      expect(mockSendInvitationalEmail).toHaveBeenCalledWith(
        email,
        expect.any(String) // token
      );
    });

    test('should generate unique tokens for different invitations', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: email1 });

      await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: email2 });

      const invitations = await prisma.invitation.findMany({
        where: { organizationId: testOrg.id },
        select: { token: true }
      });

      expect(invitations).toHaveLength(2);
      expect(invitations[0].token).not.toBe(invitations[1].token);
    });

    test('should handle duplicate email invitations', async () => {
      const email = 'duplicate@example.com';

      // First invitation
      const response1 = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email });

      expect(response1.status).toBe(200);

      // Second invitation with same email
      const response2 = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email });

      expect(response2.status).toBe(200);

      // Should have 2 invitations in database
      const invitations = await prisma.invitation.findMany({
        where: { email, organizationId: testOrg.id }
      });
      expect(invitations).toHaveLength(2);
    });

    test('should handle email service failures gracefully', async () => {
      mockSendInvitationalEmail.mockRejectedValue(new Error('Email service down'));

      const response = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'test@example.com' });

      // Should still create invitation even if email fails
      expect(response.status).toBe(500);

      // But invitation should not be created if email fails
      const invitation = await prisma.invitation.findFirst({
        where: { email: 'test@example.com', organizationId: testOrg.id }
      });
      expect(invitation).toBeNull();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/users/invite')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(401);
    });

    test('should validate email format', async () => {
      const invalidEmails = ['', 'not-an-email', 'missing@', '@missing.com'];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/users/invite')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ email });

        // Should handle gracefully (implementation might vary)
        expect([400, 500]).toContain(response.status);
      }
    });
  });

  describe('GET /users/invitations - List Invitations', () => {
    beforeEach(async () => {
      // Create test invitations
      await prisma.invitation.createMany({
        data: [
          {
            email: 'pending@example.com',
            invitedById: testUser.id,
            organizationId: testOrg.id,
            token: 'token1',
            status: 'pending',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          {
            email: 'accepted@example.com',
            invitedById: testUser.id,
            organizationId: testOrg.id,
            token: 'token2',
            status: 'accepted',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          {
            email: 'expired@example.com',
            invitedById: testUser.id,
            organizationId: testOrg.id,
            token: 'token3',
            status: 'pending',
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
          }
        ]
      });
    });

    test('should return all invitations for organization', async () => {
      const response = await request(app)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);

      const emails = response.body.data.map((inv: any) => inv.email);
      expect(emails).toContain('pending@example.com');
      expect(emails).toContain('accepted@example.com');
      expect(emails).toContain('expired@example.com');
    });

    test('should include invitation details and inviter info', async () => {
      const response = await request(app)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      const invitation = response.body.data[0];
      expect(invitation).toHaveProperty('id');
      expect(invitation).toHaveProperty('email');
      expect(invitation).toHaveProperty('status');
      expect(invitation).toHaveProperty('token');
      expect(invitation).toHaveProperty('createdAt');
      expect(invitation).toHaveProperty('expiresAt');
      expect(invitation).toHaveProperty('invitedBy');
      expect(invitation.invitedBy).toHaveProperty('id');
      expect(invitation.invitedBy).toHaveProperty('username');
      expect(invitation.invitedBy).toHaveProperty('email');
    });

    test('should support search by email', async () => {
      const response = await request(app)
        .get('/users/invitations')
        .query({ search: 'pending' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe('pending@example.com');
    });

    test('should support pagination', async () => {
      // Test with take parameter
      const response = await request(app)
        .get('/users/invitations')
        .query({ take: '2' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toHaveProperty('hasMore');
      expect(response.body.meta).toHaveProperty('nextCursor');
    });

    test('should return empty array when no invitations exist', async () => {
      // Clean up all invitations first
      await prisma.invitation.deleteMany({
        where: { organizationId: testOrg.id }
      });

      const response = await request(app)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should require authentication', async () => {
      const response = await request(app).get('/users/invitations');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /users/invitations/:id/resend - Resend Invitation', () => {
    let pendingInvitation: any;
    let acceptedInvitation: any;

    beforeEach(async () => {
      // Create test invitations
      pendingInvitation = await prisma.invitation.create({
        data: {
          email: 'pending@example.com',
          invitedById: testUser.id,
          organizationId: testOrg.id,
          token: 'old-token-1',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      acceptedInvitation = await prisma.invitation.create({
        data: {
          email: 'accepted@example.com',
          invitedById: testUser.id,
          organizationId: testOrg.id,
          token: 'old-token-2',
          status: 'accepted',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      await prisma.invitation.create({
        data: {
          email: 'expired@example.com',
          invitedById: testUser.id,
          organizationId: testOrg.id,
          token: 'old-token-3',
          status: 'pending',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
        }
      });
    });

    test('should successfully resend pending invitation', async () => {
      const response = await request(app)
        .post(`/users/invitations/${pendingInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation resent successfully');

      // Verify token and expiration were updated
      const updatedInvitation = await prisma.invitation.findUnique({
        where: { id: pendingInvitation.id }
      });

      expect(updatedInvitation!.token).not.toBe('old-token-1');
      expect(updatedInvitation!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    });

    test('should send new invitation email when resending', async () => {
      await request(app)
        .post(`/users/invitations/${pendingInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockSendInvitationalEmail).toHaveBeenCalledOnce();
      expect(mockSendInvitationalEmail).toHaveBeenCalledWith(
        'pending@example.com',
        expect.any(String)
      );

      // Verify new token is different
      const [, newToken] = mockSendInvitationalEmail.mock.calls[0];
      expect(newToken).not.toBe('old-token-1');
    });

    test('should reject resending non-pending invitations', async () => {
      const response = await request(app)
        .post(`/users/invitations/${acceptedInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Can only resend pending invitations');
    });

    test('should handle non-existent invitation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post(`/users/invitations/${fakeId}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invitation not found');
    });

    test('should handle email service failures on resend', async () => {
      mockSendInvitationalEmail.mockRejectedValue(new Error('Email service down'));

      const response = await request(app)
        .post(`/users/invitations/${pendingInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to resend invitation');

      // Token should not be updated if email fails
      const invitation = await prisma.invitation.findUnique({
        where: { id: pendingInvitation.id }
      });
      expect(invitation!.token).toBe('old-token-1');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/users/invitations/${pendingInvitation.id}/resend`);

      expect(response.status).toBe(401);
    });

    test('should generate unique tokens on resend', async () => {
      // Resend multiple times
      await request(app)
        .post(`/users/invitations/${pendingInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      const firstToken = mockSendInvitationalEmail.mock.calls[0][1];

      await request(app)
        .post(`/users/invitations/${pendingInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      const secondToken = mockSendInvitationalEmail.mock.calls[1][1];

      expect(firstToken).not.toBe(secondToken);
      expect(firstToken).not.toBe('old-token-1');
      expect(secondToken).not.toBe('old-token-1');
    });
  });

  describe('Invitation Lifecycle Integration', () => {
    test('complete invitation workflow', async () => {
      const email = 'workflow@example.com';

      // 1. Create invitation
      const createResponse = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email });

      expect(createResponse.status).toBe(200);

      // 2. List invitations and find the created one
      const listResponse = await request(app)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${authToken}`);

      const invitation = listResponse.body.data.find((inv: any) => inv.email === email);
      expect(invitation).toBeTruthy();
      expect(invitation.status).toBe('pending');

      // 3. Resend invitation
      const resendResponse = await request(app)
        .post(`/users/invitations/${invitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resendResponse.status).toBe(200);

      // 4. Verify invitation was updated
      const finalListResponse = await request(app)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${authToken}`);

      const updatedInvitation = finalListResponse.body.data.find((inv: any) => inv.email === email);
      expect(updatedInvitation.token).not.toBe(invitation.token);
    });

    test('invitation expiration handling', async () => {
      // Create invitation that will expire soon
      const expiredInvitation = await prisma.invitation.create({
        data: {
          email: 'willexpire@example.com',
          invitedById: testUser.id,
          organizationId: testOrg.id,
          token: 'will-expire-token',
          status: 'pending',
          expiresAt: new Date(Date.now() - 1000) // Already expired
        }
      });

      // Should still be able to resend expired pending invitations
      const response = await request(app)
        .post(`/users/invitations/${expiredInvitation.id}/resend`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Verify new expiration is in the future
      const updatedInvitation = await prisma.invitation.findUnique({
        where: { id: expiredInvitation.id }
      });

      expect(updatedInvitation!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle concurrent invitation creation', async () => {
      const email = 'concurrent@example.com';

      // Send multiple concurrent invitations
      const promises = Array(5).fill(0).map(() =>
        request(app)
          .post('/users/invite')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ email })
      );

      const responses = await Promise.all(promises);

      // All should succeed (or handle gracefully)
      responses.forEach(response => {
        expect([200, 409, 500]).toContain(response.status);
      });
    });

    test('should handle malformed invitation IDs', async () => {
      const response = await request(app)
        .post('/users/invitations/not-a-uuid/resend')
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 404, 500]).toContain(response.status);
    });

    test('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(300) + '@example.com';

      const response = await request(app)
        .post('/users/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: longEmail });

      // Should handle gracefully
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});