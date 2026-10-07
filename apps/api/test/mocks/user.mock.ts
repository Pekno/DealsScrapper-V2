import { User } from '@dealscrapper/database';

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed_password_123',
  role: 'USER',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  emailVerified: true,
  emailVerifiedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: new Date('2024-01-15T10:00:00Z'),
  loginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: null,
  firstName: 'Test',
  lastName: 'User',
  timezone: 'UTC',
  locale: 'en',
  emailNotifications: true,
  marketingEmails: false,
  weeklyDigest: true,
  ...overrides,
});

export interface MockPrismaService {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  userSession: {
    create: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
}

export const createMockPrismaService = (): MockPrismaService => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
});
