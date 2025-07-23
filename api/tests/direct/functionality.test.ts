import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import directRoutes from '../../src/routes/direct';
import {
  AssertionHelpers,
  DatabaseHelpers,
  HttpHelpers,
  ScenarioBuilders,
  TokenHelpers,
  prisma
} from '../utils/test-helpers';

const app = express();
app.use(express.json());
app.use('/api/direct', directRoutes);

describe('Direct Routes', () => {
  beforeAll(async () => {
    await DatabaseHelpers.cleanupTestData();
  });

  afterEach(async () => {
    await DatabaseHelpers.cleanupTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app).get('/api/direct/messages');
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const invalidToken = TokenHelpers.createInvalidToken();
      const response = await request(app)
        .get('/api/direct/messages')
        .set(HttpHelpers.createAuthHeaders(invalidToken));
      AssertionHelpers.expectErrorResponse(response, 403, 'Invalid Token');
    });

    it('should reject requests with expired token', async () => {
      const { user, organization } = await DatabaseHelpers.createTestUser();
      const expiredToken = TokenHelpers.createExpiredToken(user.id, organization.id);
      const response = await request(app)
        .get('/api/direct/messages')
        .set(HttpHelpers.createAuthHeaders(expiredToken));
      AssertionHelpers.expectErrorResponse(response, 403, 'Invalid Token');
    });
  });

  describe('GET /messages', () => {
    it('should return paginated direct messages for authenticated user', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create another user in the same organization
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      // Create a direct conversation
      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      // Create test messages
      await prisma.directMessage.createMany({
        data: [
          {
            conversationId: conversation.id,
            senderId: scenario.user.id,
            content: 'Hello from user 1'
          },
          {
            conversationId: conversation.id,
            senderId: user2.id,
            content: 'Hello from user 2'
          }
        ]
      });

      const response = await request(app)
        .get('/api/direct/messages')
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should respect pagination parameters', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create another user and conversation
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      // Create multiple messages
      for (let i = 0; i < 5; i++) {
        await prisma.directMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: scenario.user.id,
            content: `Message ${i}`
          }
        });
      }

      const response = await request(app)
        .get('/api/direct/messages?take=2')
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.meta).toHaveProperty('hasMore');
    });

    it('should only return messages from user\'s organization', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create another organization with users
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Organization' }
      });

      const otherUser1 = await prisma.user.create({
        data: {
          email: 'other1@test.com',
          username: 'other1',
          passwordHash: 'hash',
          organizationId: otherOrg.id
        }
      });

      const otherUser2 = await prisma.user.create({
        data: {
          email: 'other2@test.com',
          username: 'other2',
          passwordHash: 'hash',
          organizationId: otherOrg.id
        }
      });

      // Create conversation in other organization
      const otherConversation = await prisma.directConversation.create({
        data: {
          user1Id: otherUser1.id,
          user2Id: otherUser2.id,
          organizationId: otherOrg.id
        }
      });

      await prisma.directMessage.create({
        data: {
          conversationId: otherConversation.id,
          senderId: otherUser1.id,
          content: 'Message in other org'
        }
      });

      const response = await request(app)
        .get('/api/direct/messages')
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('GET /messages/:id', () => {
    it('should return specific direct message with sender details', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const message = await prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: scenario.user.id,
          content: 'Test message'
        }
      });

      const response = await request(app)
        .get(`/api/direct/messages/${message.id}`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', message.id);
      expect(response.body.data).toHaveProperty('content', 'Test message');
      expect(response.body.data).toHaveProperty('sender');
      expect(response.body.data.sender).toHaveProperty('username', scenario.user.username);
    });

    it('should return 404 for non-existent message', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .get('/api/direct/messages/non-existent-id')
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Message not found');
    });

    it('should not return messages from other organizations', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create message in different organization
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Organization' }
      });

      const otherUser1 = await prisma.user.create({
        data: {
          email: 'other1@test.com',
          username: 'other1',
          passwordHash: 'hash',
          organizationId: otherOrg.id
        }
      });

      const otherUser2 = await prisma.user.create({
        data: {
          email: 'other2@test.com',
          username: 'other2',
          passwordHash: 'hash',
          organizationId: otherOrg.id
        }
      });

      const otherConversation = await prisma.directConversation.create({
        data: {
          user1Id: otherUser1.id,
          user2Id: otherUser2.id,
          organizationId: otherOrg.id
        }
      });

      const otherMessage = await prisma.directMessage.create({
        data: {
          conversationId: otherConversation.id,
          senderId: otherUser1.id,
          content: 'Message in other org'
        }
      });

      const response = await request(app)
        .get(`/api/direct/messages/${otherMessage.id}`)
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Message not found');
    });
  });

  describe('GET /conversations', () => {
    it('should return user\'s direct conversations', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      await prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: scenario.user.id,
          content: 'Latest message'
        }
      });

      const response = await request(app)
        .get('/api/direct/conversations')
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0]).toHaveProperty('id', conversation.id);
      expect(response.body.data[0]).toHaveProperty('messages');
      expect(response.body.data[0].messages[0]).toHaveProperty('content', 'Latest message');
    });

    it('should not return conversations where user is not a participant', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create two other users
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const user3 = await prisma.user.create({
        data: {
          email: 'user3@test.com',
          username: 'user3',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      // Create conversation between user2 and user3 (not including scenario.user)
      await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .get('/api/direct/conversations')
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(0);
    });

    it('should not return soft-deleted conversations', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id,
          deletedAt: new Date()
        }
      });

      const response = await request(app)
        .get('/api/direct/conversations')
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('GET /conversations/:id/messages', () => {
    it('should return messages for a specific conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      await prisma.directMessage.createMany({
        data: [
          {
            conversationId: conversation.id,
            senderId: scenario.user.id,
            content: 'Message 1'
          },
          {
            conversationId: conversation.id,
            senderId: user2.id,
            content: 'Message 2'
          }
        ]
      });

      const response = await request(app)
        .get(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0]).toHaveProperty('sender');
    });

    it('should support search functionality', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      await prisma.directMessage.createMany({
        data: [
          {
            conversationId: conversation.id,
            senderId: scenario.user.id,
            content: 'Hello world'
          },
          {
            conversationId: conversation.id,
            senderId: user2.id,
            content: 'Goodbye world'
          },
          {
            conversationId: conversation.id,
            senderId: scenario.user.id,
            content: 'Different message'
          }
        ]
      });

      const response = await request(app)
        .get(`/api/direct/conversations/${conversation.id}/messages?search=world`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data.every((msg: any) => msg.content.includes('world'))).toBe(true);
    });

    it('should return 404 for non-existent conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .get('/api/direct/conversations/non-existent-id/messages')
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found');
    });

    it('should return 404 for conversation user is not part of', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create conversation between two other users
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const user3 = await prisma.user.create({
        data: {
          email: 'user3@test.com',
          username: 'user3',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .get(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found');
    });
  });

  describe('POST /conversations', () => {
    it('should create a new direct conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .send({ recipientId: user2.id });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('user1Id');
      expect(response.body).toHaveProperty('user2Id');
      expect([response.body.user1Id, response.body.user2Id]).toContain(scenario.user.id);
      expect([response.body.user1Id, response.body.user2Id]).toContain(user2.id);
    });

    it('should return existing conversation if it already exists', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      // Create existing conversation
      const existingConversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .send({ recipientId: user2.id });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(existingConversation.id);
    });

    it('should reject invalid recipient ID', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .send({ recipientId: '' });

      AssertionHelpers.expectErrorResponse(response, 400, 'Invalid Recipient');
    });

    it('should reject self as recipient', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .send({ recipientId: scenario.user.id });

      AssertionHelpers.expectErrorResponse(response, 400, 'Invalid Recipient');
    });

    it('should reject recipient from different organization', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create user in different organization
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Organization' }
      });

      const otherUser = await prisma.user.create({
        data: {
          email: 'other@test.com',
          username: 'other',
          passwordHash: 'hash',
          organizationId: otherOrg.id
        }
      });

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .send({ recipientId: otherUser.id });

      AssertionHelpers.expectErrorResponse(response, 403, 'Recipient not in your organization');
    });

    it('should reject non-existent recipient', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .send({ recipientId: 'non-existent-user-id' });

      AssertionHelpers.expectErrorResponse(response, 403, 'Recipient not in your organization');
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('should create a new message in conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders)
        .send({ content: 'Hello world!' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('content', 'Hello world!');
      expect(response.body.data).toHaveProperty('senderId', scenario.user.id);
    });

    it('should create a message with file attachment', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders)
        .send({
          content: 'File attached',
          fileUrl: '/uploads/test-file.pdf',
          fileName: 'test-file.pdf',
          mimeType: 'application/pdf'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileUrl', '/uploads/test-file.pdf');
      expect(response.body.data).toHaveProperty('fileName', 'test-file.pdf');
      expect(response.body.data).toHaveProperty('mimeType', 'application/pdf');
    });

    it('should allow file-only messages', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders)
        .send({
          fileUrl: '/uploads/image.jpg',
          fileName: 'image.jpg',
          mimeType: 'image/jpeg'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('content', '');
      expect(response.body.data).toHaveProperty('fileUrl', '/uploads/image.jpg');
    });

    it('should reject empty messages', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders)
        .send({ content: '   ' });

      AssertionHelpers.expectErrorResponse(response, 400, 'Message must include text or a file');
    });

    it('should reject messages to conversation user is not part of', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create conversation between two other users
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const user3 = await prisma.user.create({
        data: {
          email: 'user3@test.com',
          username: 'user3',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post(`/api/direct/conversations/${conversation.id}/messages`)
        .set(scenario.authHeaders)
        .send({ content: 'Unauthorized message' });

      AssertionHelpers.expectErrorResponse(response, 403, 'Unauthorized');
    });
  });

  describe('DELETE /conversations/:id', () => {
    it('should soft delete a conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .delete(`/api/direct/conversations/${conversation.id}`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Conversation soft deleted');

      // Verify conversation is soft deleted
      const deletedConversation = await prisma.directConversation.findUnique({
        where: { id: conversation.id }
      });
      expect(deletedConversation?.deletedAt).toBeTruthy();
    });

    it('should return 404 for non-existent conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .delete('/api/direct/conversations/non-existent-id')
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found');
    });

    it('should reject deletion by user not in conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      // Create conversation between two other users
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@test.com',
          username: 'user2',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const user3 = await prisma.user.create({
        data: {
          email: 'user3@test.com',
          username: 'user3',
          passwordHash: 'hash',
          organizationId: scenario.organization.id
        }
      });

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .delete(`/api/direct/conversations/${conversation.id}`)
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/direct/conversations')
        .set(scenario.authHeaders)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });
});