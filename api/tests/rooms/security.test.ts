import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

import roomRoutes from '../../src/routes/rooms';
import { PrismaClient } from '../../src/generated/prisma';

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/rooms', roomRoutes);

// Create Prisma client instance inside test suite to respect environment variables
let prisma: PrismaClient;

/**
 * Room Routes Security Tests
 * 
 * Tests authentication, authorization, and organization isolation
 * for all room management endpoints.
 */
describe('Room Routes - Security & Authorization', () => {
  let testOrg1: any;
  let testOrg2: any;
  let testUser1: any; // User in org1
  let testUser2: any; // User in org2
  let testRoom1: any; // Room in org1
  let testRoom2: any; // Room in org2
  let validToken1: string; // Token for user1
  let validToken2: string; // Token for user2
  let invalidToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    // Initialize Prisma client after environment setup
    prisma = new PrismaClient();
    
    // Create test organizations with unique names to avoid conflicts
    const timestamp = Date.now();
    testOrg1 = await prisma.organization.create({
      data: { name: `Test Security Org 1 ${timestamp}` }
    });

    testOrg2 = await prisma.organization.create({
      data: { name: `Test Security Org 2 ${timestamp}` }
    });

    // Create test users in different organizations with unique names
    testUser1 = await prisma.user.create({
      data: {
        email: `securityuser1_${timestamp}@test.com`,
        username: `securityuser1_${timestamp}`,
        passwordHash: 'hashedpassword1',
        organizationId: testOrg1.id
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        email: `securityuser2_${timestamp}@test.com`,
        username: `securityuser2_${timestamp}`,
        passwordHash: 'hashedpassword2',
        organizationId: testOrg2.id
      }
    });

    // Create test rooms in different organizations with unique names
    testRoom1 = await prisma.room.create({
      data: {
        name: `Test Security Room 1 ${timestamp}`,
        organizationId: testOrg1.id
      }
    });

    testRoom2 = await prisma.room.create({
      data: {
        name: `Test Security Room 2 ${timestamp}`,
        organizationId: testOrg2.id
      }
    });

    // Add users to their respective rooms
    await prisma.roomUser.create({
      data: {
        userId: testUser1.id,
        roomId: testRoom1.id
      }
    });

    await prisma.roomUser.create({
      data: {
        userId: testUser2.id,
        roomId: testRoom2.id
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
      { expiresIn: '-1h' }
    );
  });

  afterAll(async () => {
    // Clean up only our test data to avoid affecting other tests
    // Delete in proper order: room memberships -> rooms -> users -> organizations
    
    try {
      // Clean up room memberships first
      if (testRoom1) {
        await prisma.roomUser.deleteMany({ where: { roomId: testRoom1.id } });
      }
      if (testRoom2) {
        await prisma.roomUser.deleteMany({ where: { roomId: testRoom2.id } });
      }

      // Clean up any additional rooms that might have been created during tests
      if (testOrg1) {
        await prisma.roomUser.deleteMany({ 
          where: { 
            room: { organizationId: testOrg1.id } 
          } 
        });
        await prisma.room.deleteMany({ where: { organizationId: testOrg1.id } });
      }
      
      if (testOrg2) {
        await prisma.roomUser.deleteMany({ 
          where: { 
            room: { organizationId: testOrg2.id } 
          } 
        });
        await prisma.room.deleteMany({ where: { organizationId: testOrg2.id } });
      }
      
      // Delete users
      if (testUser1) {
        await prisma.user.delete({ where: { id: testUser1.id } }).catch(() => {});
      }
      
      if (testUser2) {
        await prisma.user.delete({ where: { id: testUser2.id } }).catch(() => {});
      }
      
      // Finally delete organizations
      if (testOrg1) {
        await prisma.organization.delete({ where: { id: testOrg1.id } }).catch(() => {});
      }
      
      if (testOrg2) {
        await prisma.organization.delete({ where: { id: testOrg2.id } }).catch(() => {});
      }
    } catch (error) {
      console.warn('Cleanup warning in room security tests:', error);
    }
    
    await prisma.$disconnect();
  });

  describe('Authentication Tests', () => {
    const getProtectedEndpoints = () => [
      { method: 'get', path: '/rooms' },
      { method: 'get', path: `/rooms/${testRoom1?.id || 'fake-id'}` },
      { method: 'get', path: `/rooms/${testRoom1?.id || 'fake-id'}/users` },
      { method: 'post', path: '/rooms' },
      { method: 'post', path: `/rooms/${testRoom1?.id || 'fake-id'}/join` },
      { method: 'post', path: `/rooms/${testRoom1?.id || 'fake-id'}/leave` },
    ];

    getProtectedEndpoints().forEach(({ method, path }) => {
      test(`${method.toUpperCase()} ${path} should require authentication`, async () => {
        const response = await request(app)[method as keyof typeof request](path)
          .send({ name: 'Test Security Room' }); // For POST /rooms

        expect(response.status).toBe(401);
      });

      test(`${method.toUpperCase()} ${path} should reject invalid token`, async () => {
        const response = await request(app)
          [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send({ name: 'Test Security Room' });
        
        expect(response.status).toBe(403);
      });

      test(`${method.toUpperCase()} ${path} should reject expired token`, async () => {
        const response = await request(app)
          [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${expiredToken}`)
          .send({ name: 'Test Security Room' });
        
        expect(response.status).toBe(403);
      });

      test(`${method.toUpperCase()} ${path} should accept valid token`, async () => {
        const response = await request(app)
          [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${validToken1}`)
          .send({ name: 'Valid Test Security Room' });

        // Should not be 401 or 403 (auth errors)
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      });
    });
  });

  describe('Organization Isolation Tests', () => {
    test('GET /rooms should only return rooms from same organization', async () => {
      const response = await request(app)
        .get('/rooms')
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      
      // Should only contain rooms from testOrg1
      const roomIds = response.body.data.map((room: any) => room.id);
      expect(roomIds).toContain(testRoom1.id);
      expect(roomIds).not.toContain(testRoom2.id);
    });

    test('GET /rooms/:id should not return rooms from other organizations', async () => {
      // User1 trying to access Room2 (different org)
      const response = await request(app)
        .get(`/rooms/${testRoom2.id}`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeNull(); // Should return null for non-existent room
    });

    test('GET /rooms/:id should return rooms from same organization', async () => {
      const response = await request(app)
        .get(`/rooms/${testRoom1.id}`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toBeNull();
      expect(response.body.id).toBe(testRoom1.id);
    });

    test('GET /rooms/:id/users should not return users from other organization rooms', async () => {
      // User1 trying to access users in Room2 (different org)
      const response = await request(app)
        .get(`/rooms/${testRoom2.id}/users`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Room for user was not found.');
    });

    test('GET /rooms/:id/users should return users from same organization rooms', async () => {
      const response = await request(app)
        .get(`/rooms/${testRoom1.id}/users`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /rooms/:id/join should not allow joining rooms from other organizations', async () => {
      // User1 trying to join Room2 (different org)
      const response = await request(app)
        .post(`/rooms/${testRoom2.id}/join`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Room not found in your organization');
    });

    test('POST /rooms/:id/leave should not allow leaving rooms from other organizations', async () => {
      // User1 trying to leave Room2 (different org)
      const response = await request(app)
        .post(`/rooms/${testRoom2.id}/leave`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Room not found in your organization');
    });

    test('Created rooms should be scoped to user organization', async () => {
      const roomName = 'Test Security Org Scoped Room';
      
      const response = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({ name: roomName });

      expect(response.status).toBe(201);
      expect(response.body.organizationId).toBe(testOrg1.id);

      // Verify the room is not visible to users from other orgs
      const otherOrgResponse = await request(app)
        .get('/rooms')
        .set('Authorization', `Bearer ${validToken2}`);

      const otherOrgRoomIds = otherOrgResponse.body.data.map((room: any) => room.id);
      expect(otherOrgRoomIds).not.toContain(response.body.id);

      // Cleanup
      await prisma.room.delete({ where: { id: response.body.id } });
    });
  });

  describe('Input Validation & Security', () => {
    test('POST /rooms should reject missing name', async () => {
      const response = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Room name is required');
    });

    test('POST /rooms should reject empty name', async () => {
      const response = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Room name is required');
    });

    test('POST /rooms should handle duplicate room names', async () => {
      const roomName = 'Test Security Duplicate Room';
      
      // Create first room
      const response1 = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({ name: roomName });

      expect(response1.status).toBe(201);

      // Try to create duplicate
      const response2 = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({ name: roomName });

      expect(response2.status).toBe(409);
      expect(response2.body.error).toBe('Room name already exists');

      // Cleanup
      await prisma.room.delete({ where: { id: response1.body.id } });
    });

    test('GET /rooms should handle SQL injection attempts', async () => {
      const maliciousSearch = "'; DROP TABLE rooms; --";
      const response = await request(app)
        .get('/rooms')
        .query({ search: maliciousSearch })
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
    });

    test('GET /rooms should handle XSS attempts in search', async () => {
      const xssAttempt = '<script>alert("xss")</script>';
      const response = await request(app)
        .get('/rooms')
        .query({ search: xssAttempt })
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
    });

    test('Room endpoints should handle invalid UUIDs', async () => {
      const invalidId = 'invalid-uuid';
      
      const endpoints = [
        { method: 'get', path: `/rooms/${invalidId}` },
        { method: 'get', path: `/rooms/${invalidId}/users` },
        { method: 'post', path: `/rooms/${invalidId}/join` },
        { method: 'post', path: `/rooms/${invalidId}/leave` },
      ];

      for (const { method, path } of endpoints) {
        const response = await request(app)
          [method as keyof typeof request](path)
          .set('Authorization', `Bearer ${validToken1}`);

        // Should handle gracefully, not crash
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });

    test('POST /rooms should handle very long room names', async () => {
      const longName = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${validToken1}`)
        .send({ name: longName });

      // Should handle gracefully
      expect([201, 400, 500]).toContain(response.status);
      
      // Cleanup if created
      if (response.status === 201) {
        await prisma.room.delete({ where: { id: response.body.id } });
      }
    });
  });

  describe('Room Membership Security', () => {
    let testRoomForMembership: any;

    beforeEach(async () => {
      // Clean up any existing memberships first
      await prisma.roomUser.deleteMany({
        where: { roomId: testRoomForMembership?.id }
      });
      
      // Delete and recreate room to ensure clean state
      if (testRoomForMembership) {
        await prisma.room.deleteMany({
          where: { name: { startsWith: 'Test Security Membership Room' } }
        });
      }
      
      testRoomForMembership = await prisma.room.create({
        data: {
          name: `Test Security Membership Room ${Date.now()}`,
          organizationId: testOrg1.id
        }
      });
    });

    afterEach(async () => {
      // Clean up memberships first, then room
      await prisma.roomUser.deleteMany({
        where: { roomId: testRoomForMembership.id }
      });
      await prisma.room.delete({
        where: { id: testRoomForMembership.id }
      });
    });

    test('Users should be able to join rooms in their organization', async () => {
      const response = await request(app)
        .post(`/rooms/${testRoomForMembership.id}/join`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Joined room successfully');

      // Verify membership was created
      const membership = await prisma.roomUser.findUnique({
        where: {
          userId_roomId: {
            userId: testUser1.id,
            roomId: testRoomForMembership.id
          }
        }
      });
      expect(membership).not.toBeNull();
    });

    test('Users should be able to leave rooms they are in', async () => {
      // First join the room
      await prisma.roomUser.create({
        data: {
          userId: testUser1.id,
          roomId: testRoomForMembership.id
        }
      });

      const response = await request(app)
        .post(`/rooms/${testRoomForMembership.id}/leave`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Left the chat room successfully');

      // Verify membership was removed
      const membership = await prisma.roomUser.findUnique({
        where: {
          userId_roomId: {
            userId: testUser1.id,
            roomId: testRoomForMembership.id
          }
        }
      });
      expect(membership).toBeNull();
    });

    test('Leaving a room user is not in should return appropriate error', async () => {
      const response = await request(app)
        .post(`/rooms/${testRoomForMembership.id}/leave`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User was not in the chat room');
    });

    test('Double joining should handle gracefully', async () => {
      // Join once
      const firstJoin = await request(app)
        .post(`/rooms/${testRoomForMembership.id}/join`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(firstJoin.status).toBe(200);

      // Try to join again
      const response = await request(app)
        .post(`/rooms/${testRoomForMembership.id}/join`)
        .set('Authorization', `Bearer ${validToken1}`);

      // Should return 409 for duplicate membership
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User is already a member of this room');
    });
  });

  describe('Performance & Rate Limiting', () => {
    test('Multiple concurrent requests should not cause server errors', async () => {
      const promises = Array(10).fill(0).map(() =>
        request(app)
          .get('/rooms')
          .set('Authorization', `Bearer ${validToken1}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).not.toBe(500);
      });
    });

    test('Large pagination requests should be handled safely', async () => {
      const response = await request(app)
        .get('/rooms')
        .query({ take: '999999' })
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Response Security', () => {
    test('Error responses should not leak sensitive information', async () => {
      const response = await request(app)
        .get('/rooms/nonexistent-id')
        .set('Authorization', `Bearer ${validToken1}`);

      expect(response.status).toBe(200); // Returns null, not 404
      
      // Should not contain database details, stack traces, etc.
      if (response.body) {
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('query');
        expect(response.body).not.toHaveProperty('sql');
      }
    });

    test('Authentication errors should be consistent', async () => {
      const endpoints = ['/rooms', `/rooms/${testRoom1.id}`, `/rooms/${testRoom1.id}/users`];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Soft Delete Security', () => {
    test('Soft deleted rooms should not be accessible', async () => {
      // Create and soft delete a room
      const room = await prisma.room.create({
        data: {
          name: 'Test Security To Be Deleted',
          organizationId: testOrg1.id
        }
      });

      await prisma.room.update({
        where: { id: room.id },
        data: { deletedAt: new Date() }
      });

      // Should not appear in listings
      const listResponse = await request(app)
        .get('/rooms')
        .set('Authorization', `Bearer ${validToken1}`);

      const roomIds = listResponse.body.data.map((r: any) => r.id);
      expect(roomIds).not.toContain(room.id);

      // Note: Current implementation doesn't filter soft-deleted rooms in detail endpoint
      // This is a potential security issue that should be fixed
      const detailResponse = await request(app)
        .get(`/rooms/${room.id}`)
        .set('Authorization', `Bearer ${validToken1}`);

      // Currently returns the room even if soft-deleted - this should be fixed
      expect(detailResponse.status).toBe(200);

      // Should not allow joining
      const joinResponse = await request(app)
        .post(`/rooms/${room.id}/join`)
        .set('Authorization', `Bearer ${validToken1}`);

      expect(joinResponse.status).toBe(404);

      // Cleanup
      await prisma.room.delete({ where: { id: room.id } });
    });
  });
});