import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import videoRoutes from '../../src/routes/video';
import { redis } from '../../src/redis';
import { 
  DatabaseHelpers, 
  TokenHelpers, 
  HttpHelpers, 
  AssertionHelpers,
  ScenarioBuilders,
  MockHelpers,
  prisma 
} from '../utils/test-helpers';

// Mock Redis
vi.mock('../../src/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    quit: vi.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api/video', videoRoutes);

describe('Video Routes', () => {
  beforeAll(async () => {
    await DatabaseHelpers.cleanupTestData();
  });

  beforeEach(() => {
    // Reset Redis mocks before each test
    vi.clearAllMocks();
    MockHelpers.setupRedisMocks(redis);
  });

  afterEach(async () => {
    await DatabaseHelpers.cleanupTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app).post('/api/video/call/initiate');
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const invalidToken = TokenHelpers.createInvalidToken();
      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(HttpHelpers.createAuthHeaders(invalidToken));
      AssertionHelpers.expectErrorResponse(response, 403, 'Invalid Token');
    });
  });

  describe('POST /call/initiate', () => {
    it('should successfully initiate a video call', async () => {
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

      // Mock Redis calls to indicate users are not in any calls
      (redis.get as any).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: conversation.id,
          participantId: user2.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('conversationId', conversation.id);
      expect(response.body.data).toHaveProperty('initiatorId', scenario.user.id);
      expect(response.body.data).toHaveProperty('participantId', user2.id);
      expect(response.body.data).toHaveProperty('status', 'pending');
      expect(response.body.data).toHaveProperty('initiator');
      expect(response.body.data).toHaveProperty('participant');
      expect(response.body.data.initiator).toHaveProperty('username', scenario.user.username);
      expect(response.body.data.participant).toHaveProperty('username', user2.username);

      // Verify Redis calls were made to check user status
      expect(redis.get).toHaveBeenCalledWith(`user:call:${scenario.user.id}`);
      expect(redis.get).toHaveBeenCalledWith(`user:call:${user2.id}`);
    });

    it('should reject call initiation with missing fields', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: 'some-id'
          // Missing participantId
        });

      AssertionHelpers.expectErrorResponse(response, 400, 'Missing required fields');
    });

    it('should reject call initiation for non-existent conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: 'non-existent-id',
          participantId: 'some-user-id'
        });

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found or access denied');
    });

    it('should reject call initiation for conversation user is not part of', async () => {
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
      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: conversation.id,
          participantId: user2.id
        });

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found or access denied');
    });

    it('should reject call initiation when participant is not part of conversation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();
      
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

      // Create conversation between scenario.user and user2
      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: scenario.user.id < user2.id ? scenario.user.id : user2.id,
          user2Id: scenario.user.id < user2.id ? user2.id : scenario.user.id,
          organizationId: scenario.organization.id
        }
      });

      // Try to initiate call with user3 who is not part of the conversation
      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: conversation.id,
          participantId: user3.id
        });

      AssertionHelpers.expectErrorResponse(response, 400, 'Participant not part of conversation');
    });

    it('should reject call initiation when initiator is already in a call', async () => {
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

      // Mock that initiator is already in a call
      (redis.get as any).mockImplementation((key: string) => {
        if (key === `user:call:${scenario.user.id}`) {
          return Promise.resolve('existing-call-id');
        }
        return Promise.resolve(null);
      });

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: conversation.id,
          participantId: user2.id
        });

      AssertionHelpers.expectErrorResponse(response, 409, 'One or both users are already in a call');
    });

    it('should reject call initiation when participant is already in a call', async () => {
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

      // Mock that participant is already in a call
      (redis.get as any).mockImplementation((key: string) => {
        if (key === `user:call:${user2.id}`) {
          return Promise.resolve('existing-call-id');
        }
        return Promise.resolve(null);
      });

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: conversation.id,
          participantId: user2.id
        });

      AssertionHelpers.expectErrorResponse(response, 409, 'One or both users are already in a call');
    });
  });

  describe('GET /call/history/:conversationId', () => {
    it('should return call history for conversation', async () => {
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

      // Create test video calls
      await prisma.videoCall.createMany({
        data: [
          {
            conversationId: conversation.id,
            initiatorId: scenario.user.id,
            participantId: user2.id,
            status: 'ended',
            duration: 120
          },
          {
            conversationId: conversation.id,
            initiatorId: user2.id,
            participantId: scenario.user.id,
            status: 'ended',
            duration: 300
          }
        ]
      });

      const response = await request(app)
        .get(`/api/video/call/history/${conversation.id}`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('calls');
      expect(response.body.data).toHaveProperty('totalCount', 2);
      expect(response.body.data).toHaveProperty('hasMore', false);
      expect(response.body.data.calls.length).toBe(2);
      expect(response.body.data.calls[0]).toHaveProperty('initiator');
      expect(response.body.data.calls[0]).toHaveProperty('participant');
    });

    it('should support pagination', async () => {
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

      // Create 5 test video calls
      for (let i = 0; i < 5; i++) {
        await prisma.videoCall.create({
          data: {
            conversationId: conversation.id,
            initiatorId: scenario.user.id,
            participantId: user2.id,
            status: 'ended',
            duration: 60 + i
          }
        });
      }

      // Request first 2 calls
      const response = await request(app)
        .get(`/api/video/call/history/${conversation.id}?limit=2&offset=0`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.calls.length).toBe(2);
      expect(response.body.data.totalCount).toBe(5);
      expect(response.body.data.hasMore).toBe(true);

      // Request next 2 calls
      const response2 = await request(app)
        .get(`/api/video/call/history/${conversation.id}?limit=2&offset=2`)
        .set(scenario.authHeaders);

      expect(response2.status).toBe(200);
      expect(response2.body.data.calls.length).toBe(2);
      expect(response2.body.data.hasMore).toBe(true);
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
        .get(`/api/video/call/history/${conversation.id}`)
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Conversation not found or access denied');
    });

    it('should return empty history for conversation with no calls', async () => {
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
        .get(`/api/video/call/history/${conversation.id}`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.calls.length).toBe(0);
      expect(response.body.data.totalCount).toBe(0);
      expect(response.body.data.hasMore).toBe(false);
    });
  });

  describe('PUT /call/:callId/status', () => {
    it('should update call status to active', async () => {
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

      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: scenario.user.id,
          participantId: user2.id,
          status: 'pending'
        }
      });

      const response = await request(app)
        .put(`/api/video/call/${videoCall.id}/status`)
        .set(scenario.authHeaders)
        .send({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'active');
      expect(response.body.data).toHaveProperty('id', videoCall.id);
    });

    it('should calculate duration when ending an active call', async () => {
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

      // Create call with a past start time to simulate duration
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago
      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: scenario.user.id,
          participantId: user2.id,
          status: 'active',
          startedAt: pastTime
        }
      });

      const response = await request(app)
        .put(`/api/video/call/${videoCall.id}/status`)
        .set(scenario.authHeaders)
        .send({ status: 'ended' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('status', 'ended');
      expect(response.body.data).toHaveProperty('duration');
      expect(response.body.data.duration).toBeGreaterThan(50); // Should be around 60 seconds
      expect(response.body.data).toHaveProperty('endedAt');

      // Verify Redis cleanup was called
      expect(redis.del).toHaveBeenCalledWith(`video:call:${videoCall.id}`);
      expect(redis.del).toHaveBeenCalledWith(`user:call:${scenario.user.id}`);
      expect(redis.del).toHaveBeenCalledWith(`user:call:${user2.id}`);
    });

    it('should reject invalid status values', async () => {
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

      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: scenario.user.id,
          participantId: user2.id,
          status: 'pending'
        }
      });

      const response = await request(app)
        .put(`/api/video/call/${videoCall.id}/status`)
        .set(scenario.authHeaders)
        .send({ status: 'invalid-status' });

      AssertionHelpers.expectErrorResponse(response, 400, 'Invalid status');
    });

    it('should reject status update by user not part of call', async () => {
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

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      // Create call between user2 and user3
      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: user2.id,
          participantId: user3.id,
          status: 'pending'
        }
      });

      const response = await request(app)
        .put(`/api/video/call/${videoCall.id}/status`)
        .set(scenario.authHeaders)
        .send({ status: 'active' });

      AssertionHelpers.expectErrorResponse(response, 403, 'Access denied');
    });

    it('should return 404 for non-existent call', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .put('/api/video/call/non-existent-id/status')
        .set(scenario.authHeaders)
        .send({ status: 'active' });

      AssertionHelpers.expectErrorResponse(response, 404, 'Call not found');
    });

    it('should cleanup Redis when call is rejected', async () => {
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

      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: scenario.user.id,
          participantId: user2.id,
          status: 'pending'
        }
      });

      const response = await request(app)
        .put(`/api/video/call/${videoCall.id}/status`)
        .set(scenario.authHeaders)
        .send({ status: 'rejected' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('status', 'rejected');
      expect(response.body.data).toHaveProperty('endedAt');

      // Verify Redis cleanup
      expect(redis.del).toHaveBeenCalledWith(`video:call:${videoCall.id}`);
      expect(redis.del).toHaveBeenCalledWith(`user:call:${scenario.user.id}`);
      expect(redis.del).toHaveBeenCalledWith(`user:call:${user2.id}`);
    });
  });

  describe('DELETE /call/:callId', () => {
    it('should end an active call and calculate duration', async () => {
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

      // Create active call with past start time
      const pastTime = new Date(Date.now() - 120000); // 2 minutes ago
      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: scenario.user.id,
          participantId: user2.id,
          status: 'active',
          startedAt: pastTime
        }
      });

      const response = await request(app)
        .delete(`/api/video/call/${videoCall.id}`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'ended');
      expect(response.body.data).toHaveProperty('duration');
      expect(response.body.data.duration).toBeGreaterThan(100); // Should be around 120 seconds
      expect(response.body.data).toHaveProperty('endedAt');

      // Verify Redis cleanup
      expect(redis.del).toHaveBeenCalledWith(`video:call:${videoCall.id}`);
      expect(redis.del).toHaveBeenCalledWith(`user:call:${scenario.user.id}`);
      expect(redis.del).toHaveBeenCalledWith(`user:call:${user2.id}`);
    });

    it('should end a call that already has duration', async () => {
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

      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: scenario.user.id,
          participantId: user2.id,
          status: 'active',
          duration: 180
        }
      });

      const response = await request(app)
        .delete(`/api/video/call/${videoCall.id}`)
        .set(scenario.authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('status', 'ended');
      expect(response.body.data).toHaveProperty('duration', 180);
    });

    it('should return 404 for non-existent call', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .delete('/api/video/call/non-existent-id')
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 404, 'Call not found');
    });

    it('should reject call deletion by user not part of call', async () => {
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

      const conversation = await prisma.directConversation.create({
        data: {
          user1Id: user2.id < user3.id ? user2.id : user3.id,
          user2Id: user2.id < user3.id ? user3.id : user2.id,
          organizationId: scenario.organization.id
        }
      });

      const videoCall = await prisma.videoCall.create({
        data: {
          conversationId: conversation.id,
          initiatorId: user2.id,
          participantId: user3.id,
          status: 'active'
        }
      });

      const response = await request(app)
        .delete(`/api/video/call/${videoCall.id}`)
        .set(scenario.authHeaders);

      AssertionHelpers.expectErrorResponse(response, 403, 'Access denied');
    });
  });

  describe('Organization Access Control', () => {
    it('should prevent access to calls from different organizations', async () => {
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

      const otherConversation = await prisma.directConversation.create({
        data: {
          user1Id: otherUser1.id,
          user2Id: otherUser2.id,
          organizationId: otherOrg.id
        }
      });

      const otherVideoCall = await prisma.videoCall.create({
        data: {
          conversationId: otherConversation.id,
          initiatorId: otherUser1.id,
          participantId: otherUser2.id,
          status: 'active'
        }
      });

      // Try to access call from different organization
      const response = await request(app)
        .put(`/api/video/call/${otherVideoCall.id}/status`)
        .set(scenario.authHeaders)
        .send({ status: 'ended' });

      AssertionHelpers.expectErrorResponse(response, 403, 'Access denied');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid call IDs in status updates', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .put('/api/video/call/invalid-uuid/status')
        .set(scenario.authHeaders)
        .send({ status: 'active' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Call not found');
    });

    it('should handle Redis errors gracefully', async () => {
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

      // Mock Redis to throw an error
      (redis.get as any).mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({
          conversationId: conversation.id,
          participantId: user2.id
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to initiate video call');
    });

    it('should handle missing required fields in call initiation', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .post('/api/video/call/initiate')
        .set(scenario.authHeaders)
        .send({}); // Missing required fields

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should handle missing status in call status update', async () => {
      const scenario = await ScenarioBuilders.createAuthenticatedUserScenario();

      const response = await request(app)
        .put('/api/video/call/some-call-id/status')
        .set(scenario.authHeaders)
        .send({}); // Missing status field

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
  });
});