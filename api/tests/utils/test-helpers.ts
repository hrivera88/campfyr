import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { expect, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma';

export const prisma = new PrismaClient();

/**
 * Test data factory for creating consistent test data
 */
interface TestUser {
  email: string;
  username: string;
  password: string;
  organizationName: string;
}

interface TestOrganization {
  name: string;
}

interface TestInvitation {
  email: string;
  token: string;
  expiresAt: Date;
  status: string;
}

export const TestDataFactory = {
  user: (overrides: Partial<TestUser> = {}): TestUser => ({
    email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
    username: `testuser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    password: 'password123',
    organizationName: `Test Organization ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...overrides
  }),

  organization: (overrides: Partial<TestOrganization> = {}): TestOrganization => ({
    name: `Test Organization ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...overrides
  }),

  invitation: (overrides: Partial<TestInvitation> = {}): TestInvitation => ({
    email: `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
    token: `test-invite-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    status: 'pending',
    ...overrides
  })
};

/**
 * Database cleanup utilities
 */
export const DatabaseHelpers = {
  async cleanupTestData() {
    // Clean in order to respect foreign key constraints
    await prisma.invitation.deleteMany();
    await prisma.videoCall.deleteMany();
    await prisma.directMessage.deleteMany();
    await prisma.directConversation.deleteMany();
    await prisma.message.deleteMany();
    await prisma.roomUser.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  },

  async createTestUser(userData: any = {}) {
    const user = TestDataFactory.user(userData);

    // Create organization first
    const organization = await prisma.organization.create({
      data: { name: user.organizationName }
    });

    // Create user
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const createdUser = await prisma.user.create({
      data: {
        email: user.email,
        username: user.username,
        passwordHash: hashedPassword,
        organizationId: organization.id
      }
    });

    return { user: createdUser, organization, plainPassword: user.password };
  },

  async createTestOrganizationWithUsers(userCount: number = 2) {
    const orgData = TestDataFactory.organization();
    const organization = await prisma.organization.create({
      data: { name: orgData.name }
    });

    const users: Array<any> = [];
    for (let i = 0; i < userCount; i++) {
      const timestamp = Date.now();
      const userData = TestDataFactory.user({
        email: `user${i}-${timestamp}-${Math.random().toString(36).substr(2, 9)}@example.com`,
        username: `user${i}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
      });

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          passwordHash: hashedPassword,
          organizationId: organization.id
        }
      });
      users.push({ ...user, plainPassword: userData.password });
    }

    return { organization, users };
  }
};

/**
 * JWT token utilities for testing
 */
export const TokenHelpers = {
  createValidToken(userId: string, organizationId: string, expiresIn: string = '1h'): string {
    const secret = process.env.JWT_SECRET || 'test-secret';
    return jwt.sign(
      { userId, organizationId },
      secret,
      { expiresIn: expiresIn as any }
    );
  },

  createExpiredToken(userId: string, organizationId: string): string {
    const secret = process.env.JWT_SECRET || 'test-secret';
    return jwt.sign(
      { userId, organizationId },
      secret,
      { expiresIn: '-1h' as any }
    );
  },

  createInvalidToken(): string {
    return 'invalid.token.signature';
  },

  createValidRefreshToken(userId: string, organizationId: string, expiresIn: string = '7d'): string {
    const secret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
    return jwt.sign(
      { userId, organizationId },
      secret,
      { expiresIn: expiresIn as any }
    );
  },

  decodeToken(token: string) {
    return jwt.decode(token) as any;
  }
};

/**
 * HTTP test utilities
 */
export const HttpHelpers = {
  extractCookieValue(cookieHeader: string, cookieName: string): string | null {
    const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
    return match ? match[1] : null;
  },

  createAuthHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
  },

  createCookieHeader(cookies: Record<string, string>) {
    return Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }
};

/**
 * Mock utilities for external dependencies
 */
export const MockHelpers = {
  setupRedisMocks(redisMock: any) {
    redisMock.set.mockResolvedValue('OK');
    redisMock.get.mockResolvedValue(null);
    redisMock.del.mockResolvedValue(1);
  },

  setupEmailMocks(emailMock: any) {
    emailMock.sendPasswordResetEmail.mockResolvedValue(undefined);
    emailMock.sendInvitationalEmail.mockResolvedValue(undefined);
  },

  setupPrismaMocks(prismaMock: any) {
    // Mock all common Prisma operations
    if (prismaMock.user) {
      prismaMock.user.findUnique = vi.fn();
      prismaMock.user.findMany = vi.fn();
      prismaMock.user.create = vi.fn();
      prismaMock.user.update = vi.fn();
      prismaMock.user.delete = vi.fn();
    }
    
    if (prismaMock.room) {
      prismaMock.room.findUnique = vi.fn();
      prismaMock.room.findMany = vi.fn();
      prismaMock.room.create = vi.fn();
      prismaMock.room.update = vi.fn();
      prismaMock.room.delete = vi.fn();
    }
    
    if (prismaMock.message) {
      prismaMock.message.findMany = vi.fn();
      prismaMock.message.create = vi.fn();
      prismaMock.message.update = vi.fn();
      prismaMock.message.delete = vi.fn();
    }
    
    if (prismaMock.directMessage) {
      prismaMock.directMessage.findMany = vi.fn();
      prismaMock.directMessage.create = vi.fn();
      prismaMock.directMessage.update = vi.fn();
      prismaMock.directMessage.delete = vi.fn();
    }
    
    if (prismaMock.directConversation) {
      prismaMock.directConversation.findUnique = vi.fn();
      prismaMock.directConversation.findMany = vi.fn();
      prismaMock.directConversation.create = vi.fn();
      prismaMock.directConversation.update = vi.fn();
      prismaMock.directConversation.delete = vi.fn();
    }
    
    if (prismaMock.videoCall) {
      prismaMock.videoCall.findUnique = vi.fn();
      prismaMock.videoCall.findMany = vi.fn();
      prismaMock.videoCall.create = vi.fn();
      prismaMock.videoCall.update = vi.fn();
      prismaMock.videoCall.delete = vi.fn();
    }
    
    if (prismaMock.organization) {
      prismaMock.organization.findUnique = vi.fn();
      prismaMock.organization.findMany = vi.fn();
      prismaMock.organization.create = vi.fn();
      prismaMock.organization.update = vi.fn();
      prismaMock.organization.delete = vi.fn();
    }
  },

  createMockRequest(overrides: any = {}) {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      cookies: {},
      ...overrides
    };
  },

  createMockResponse() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.cookie = vi.fn().mockReturnValue(res);
    res.clearCookie = vi.fn().mockReturnValue(res);
    return res;
  }
};

/**
 * Assertion helpers for common test patterns
 */
export const AssertionHelpers = {
  expectValidJWT(token: string) {
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const decoded = jwt.decode(token);
    expect(decoded).toBeTruthy();
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('organizationId');

    return decoded as any;
  },

  expectValidRefreshCookie(cookieHeader: string) {
    expect(cookieHeader).toBeTruthy();
    expect(cookieHeader).toMatch(/refreshToken=.*HttpOnly/);
    expect(cookieHeader).toMatch(/Path=\//);
    expect(cookieHeader).toMatch(/SameSite=Strict/i);
  },

  expectClearedCookie(cookieHeader: string) {
    expect(cookieHeader).toMatch(/refreshToken=;/);
    expect(cookieHeader).toMatch(/Expires=Thu, 01 Jan 1970/);
  },

  expectErrorResponse(response: any, statusCode: number, errorMessage?: string) {
    expect(response.status).toBe(statusCode);
    expect(response.body).toHaveProperty('error');
    if (errorMessage) {
      expect(response.body.error).toBe(errorMessage);
    }
  }
};

/**
 * Test scenario builders for complex workflows
 */
export const ScenarioBuilders = {
  async createAuthenticatedUserScenario() {
    const { user, organization, plainPassword } = await DatabaseHelpers.createTestUser();
    const token = TokenHelpers.createValidToken(user.id, organization.id);
    const refreshToken = TokenHelpers.createValidRefreshToken(user.id, organization.id);

    return {
      user,
      organization,
      plainPassword,
      token,
      refreshToken,
      authHeaders: HttpHelpers.createAuthHeaders(token),
      cookieHeader: HttpHelpers.createCookieHeader({ refreshToken })
    };
  },

  async createExpiredTokenScenario() {
    const { user, organization } = await DatabaseHelpers.createTestUser();
    const expiredToken = TokenHelpers.createExpiredToken(user.id, organization.id);
    const validRefreshToken = TokenHelpers.createValidRefreshToken(user.id, organization.id);

    return {
      user,
      organization,
      expiredToken,
      validRefreshToken,
      authHeaders: HttpHelpers.createAuthHeaders(expiredToken),
      cookieHeader: HttpHelpers.createCookieHeader({ refreshToken: validRefreshToken })
    };
  }
};

/**
 * Performance testing utilities
 */
export const PerformanceHelpers = {
  async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    return { result, time: end - start };
  },

  async expectMaxExecutionTime<T>(fn: () => Promise<T>, maxTime: number): Promise<T> {
    const { result, time } = await this.measureExecutionTime(fn);
    expect(time).toBeLessThan(maxTime);
    return result;
  }
};

/**
 * Error simulation utilities
 */
export const ErrorSimulation = {
  simulateDatabaseError(prismaMethod: any, error: Error) {
    prismaMethod.mockRejectedValue(error);
  },

  simulateRedisError(redisMethod: any, error: Error) {
    redisMethod.mockRejectedValue(error);
  },

  simulateNetworkTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), 5000);
    });
  }
};