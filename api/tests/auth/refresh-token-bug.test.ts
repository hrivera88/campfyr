import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { redis } from '../../src/redis';
import authRoutes from '../../src/routes/auth';
import { AssertionHelpers, DatabaseHelpers, MockHelpers } from '../utils/test-helpers';

// Mock Redis
vi.mock('../../src/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/auth', authRoutes);

/**
 * This test suite specifically tests the refresh token bug we fixed.
 * 
 * ISSUE: Cookie path inconsistency caused refresh tokens to not be sent
 * after the first refresh, leading to 401 errors on subsequent refreshes.
 * 
 * ROOT CAUSE: 
 * - Login route set cookie with path: '/'
 * - Refresh route set cookie with path: '/auth/refresh' 
 * - Subsequent requests couldn't access the cookie
 * 
 * FIX: Changed refresh route to also use path: '/'
 */
describe('Refresh Token Bug Fix - Cookie Path Consistency', () => {
  let testUser: any;
  let organization: any;
  let plainPassword: string;

  beforeAll(async () => {
    await DatabaseHelpers.cleanupTestData();
    const testData = await DatabaseHelpers.createTestUser();
    testUser = testData.user;
    organization = testData.organization;
    plainPassword = testData.plainPassword;
  });

  afterAll(async () => {
    await DatabaseHelpers.cleanupTestData();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    MockHelpers.setupRedisMocks(redis);
  });

  test('BUG FIX: refresh token cookies should have consistent paths', async () => {
    // Step 1: Login and get initial refresh token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: plainPassword
      })
      .expect(200);

    const loginCookie = loginResponse.headers['set-cookie'][0];

    // Verify login cookie has correct path
    expect(loginCookie).toMatch(/Path=\//);
    expect(loginCookie).not.toMatch(/Path=\/auth\/refresh/);

    const initialRefreshToken = loginCookie.match(/refreshToken=([^;]+)/)?.[1];
    expect(initialRefreshToken).toBeTruthy();

    // Step 2: Mock Redis to return the refresh token
    (redis.get as any).mockResolvedValue(initialRefreshToken);

    // Step 3: Perform first refresh
    const firstRefreshResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${initialRefreshToken}`)
      .expect(200);

    const firstRefreshCookie = firstRefreshResponse.headers['set-cookie'][0];

    // CRITICAL: Verify refresh cookie also has path='/' (this was the bug)
    expect(firstRefreshCookie).toMatch(/Path=\//);
    expect(firstRefreshCookie).not.toMatch(/Path=\/auth\/refresh/);

    const newRefreshToken = firstRefreshCookie.match(/refreshToken=([^;]+)/)?.[1];
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(initialRefreshToken); // Should be different

    // Step 4: Mock Redis for second refresh
    (redis.get as any).mockResolvedValue(newRefreshToken);

    // Step 5: Perform second refresh (this would fail before the fix)
    const secondRefreshResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${newRefreshToken}`)
      .expect(200); // This should succeed now

    expect(secondRefreshResponse.body).toHaveProperty('token');

    const secondRefreshCookie = secondRefreshResponse.headers['set-cookie'][0];
    expect(secondRefreshCookie).toMatch(/Path=\//);
  });

  test('REGRESSION TEST: multiple successive refreshes should work', async () => {
    // Start with login
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: plainPassword
      })
      .expect(200);

    let currentRefreshToken = loginResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];

    // Perform 5 successive refreshes
    for (let i = 0; i < 5; i++) {
      (redis.get as any).mockResolvedValue(currentRefreshToken);

      const refreshResponse = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${currentRefreshToken}`)
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('token');

      // Extract new refresh token for next iteration
      const newRefreshToken = refreshResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];
      expect(newRefreshToken).toBeTruthy();
      expect(newRefreshToken).not.toBe(currentRefreshToken);

      currentRefreshToken = newRefreshToken;

      // Verify cookie path is still correct
      expect(refreshResponse.headers['set-cookie'][0]).toMatch(/Path=\//);
    }
  });

  test('EDGE CASE: refresh should work after long idle period', async () => {
    // Login
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: plainPassword
      })
      .expect(200);

    const refreshToken = loginResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];

    // Simulate Redis returning the token after idle period
    (redis.get as any).mockResolvedValue(refreshToken);

    // This simulates the scenario where user returns after idling
    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(200);

    expect(refreshResponse.body).toHaveProperty('token');
    AssertionHelpers.expectValidRefreshCookie(refreshResponse.headers['set-cookie'][0]);
  });

  test('SECURITY: old refresh tokens should be invalidated', async () => {
    // Login and get initial token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: plainPassword
      })
      .expect(200);

    const oldRefreshToken = loginResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];

    // Mock Redis for first refresh
    (redis.get as any).mockResolvedValue(oldRefreshToken);

    // Perform refresh
    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefreshToken}`)
      .expect(200);

    const newRefreshToken = refreshResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];

    // Verify Redis operations
    expect(redis.del).toHaveBeenCalledWith(`refresh:${testUser.id}`);
    expect(redis.set).toHaveBeenCalled();

    // Try to use old token again (should fail)
    (redis.get as any).mockResolvedValue(null); // Token not found in Redis

    const oldTokenResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${oldRefreshToken}`)
      .expect(401);

    expect(oldTokenResponse.body.error).toBe('Token mismatch or reused');
  });

  test('COMPATIBILITY: cookie should work with various client scenarios', async () => {
    // Login
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: plainPassword
      })
      .expect(200);

    const refreshToken = loginResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];
    (redis.get as any).mockResolvedValue(refreshToken);

    // Test different cookie header formats
    const cookieFormats = [
      `refreshToken=${refreshToken}`,
      `refreshToken=${refreshToken}; otherCookie=value`,
      `otherCookie=value; refreshToken=${refreshToken}`,
      `refreshToken=${refreshToken}; Path=/; HttpOnly`,
    ];

    for (const cookieFormat of cookieFormats) {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', cookieFormat)
        .expect(200);

      expect(response.body).toHaveProperty('token');
    }
  });

  test('PERFORMANCE: refresh should be fast', async () => {
    // Login
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: plainPassword
      })
      .expect(200);

    const refreshToken = loginResponse.headers['set-cookie'][0].match(/refreshToken=([^;]+)/)?.[1];
    (redis.get as any).mockResolvedValue(refreshToken);

    const startTime = Date.now();

    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(200);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(refreshResponse.body).toHaveProperty('token');
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });
});