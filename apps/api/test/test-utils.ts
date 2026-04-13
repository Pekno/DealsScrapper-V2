import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@dealscrapper/database';
const request = require('supertest');

/**
 * Common test data and utilities
 */
export const TestData = {
  validUser: {
    email: 'test@example.com',
    password: 'StrongP@ssw0rd',
  },

  invalidEmail: {
    email: 'invalid-email',
    password: 'StrongP@ssw0rd',
  },

  shortPassword: {
    email: 'test@example.com',
    password: '1234567', // 7 characters, min is 8
  },

  generateUniqueUser: (() => {
    let counter = 0;
    return () => ({
      email: `test-${Date.now()}-${counter++}@example.com`,
      password: 'StrongP@ssw0rd',
    });
  })(),
};

/**
 * Test application factory for E2E tests
 */
export class TestApp {
  private app: INestApplication;
  private prismaService: PrismaService;

  async initialize(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication<NestExpressApplication>();

    // Apply the same validation pipe as in main.ts
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    this.prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await this.app.init();
    return this.app;
  }

  getApp(): INestApplication {
    return this.app;
  }

  getPrismaService(): PrismaService {
    return this.prismaService;
  }

  async cleanDatabase(): Promise<void> {
    await this.prismaService.user.deleteMany();
  }

  async close(): Promise<void> {
    if (this.prismaService) {
      await this.prismaService.$disconnect();
    }
    if (this.app) {
      await this.app.close();
    }
  }
}

/**
 * Authentication test helpers
 */
export class AuthTestHelpers {
  constructor(private app: INestApplication) {}

  /**
   * Register a new user and return the response
   */
  async registerUser(userData = TestData.generateUniqueUser()) {
    return request(this.app.getHttpServer())
      .post('/auth/register')
      .send(userData);
  }

  /**
   * Login with user credentials and return the response
   */
  async loginUser(userData = TestData.validUser) {
    return request(this.app.getHttpServer()).post('/auth/login').send(userData);
  }

  /**
   * Register a user and return the access token
   */
  async getAccessToken(
    userData = TestData.generateUniqueUser()
  ): Promise<string> {
    const response = await this.registerUser(userData);
    return response.body.access_token;
  }

  /**
   * Get user profile with authorization token
   */
  async getProfile(accessToken: string) {
    return request(this.app.getHttpServer())
      .get('/users/profile')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  /**
   * Complete authentication flow: register → login → profile
   */
  async completeAuthFlow(userData = TestData.generateUniqueUser()) {
    // Register
    const registerResponse = await this.registerUser(userData);

    // Login
    const loginResponse = await this.loginUser(userData);

    // Get Profile
    const profileResponse = await this.getProfile(
      loginResponse.body.access_token
    );

    return {
      register: registerResponse,
      login: loginResponse,
      profile: profileResponse,
      userData,
      accessToken: loginResponse.body.access_token,
    };
  }
}

/**
 * Mock factories for unit tests
 */
export const MockFactories = {
  user: (overrides = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  authResponse: (overrides = {}) => ({
    access_token: 'jwt-token',
    user: {
      id: 'user-1',
      email: 'test@example.com',
      createdAt: new Date(),
    },
    ...overrides,
  }),

  createMockPrismaService: () => ({
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  }),

  createMockAuthService: () => ({
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
  }),

  createMockUsersService: () => ({
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }),

  createMockJwtService: () => ({
    sign: jest.fn(),
    verify: jest.fn(),
  }),
};

/**
 * Test assertions and custom matchers
 */
export const TestAssertions = {
  expectValidAuthResponse: (response: any) => {
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('email');
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.access_token).toMatch(
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
    );
  },

  expectValidUser: (user: any, isProfileResponse = false) => {
    // Check for either userId or id (profile returns userId, user object returns id)
    if (!user.hasOwnProperty('userId') && !user.hasOwnProperty('id')) {
      throw new Error('User object must have either userId or id property');
    }
    expect(user).toHaveProperty('email');

    // Profile responses don't include createdAt
    if (!isProfileResponse) {
      expect(user).toHaveProperty('createdAt');
    }

    expect(user).not.toHaveProperty('password');
  },

  expectValidationError: (response: any) => {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
  },

  expectUnauthorizedError: (response: any) => {
    expect(response.status).toBe(401);
  },

  expectConflictError: (response: any) => {
    expect(response.status).toBe(409);
  },
};

/**
 * Database test utilities
 */
export const DatabaseTestUtils = {
  async createTestUser(
    prisma: PrismaService,
    userData = TestData.generateUniqueUser()
  ) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    return prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
      },
    });
  },

  async getUserByEmail(prisma: PrismaService, email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  async cleanAllUsers(prisma: PrismaService) {
    return prisma.user.deleteMany();
  },
};
