/**
 * Business-focused test data factories for users
 */
import { UserCreateInput } from '@dealscrapper/database';

type UserCreateData = Omit<UserCreateInput, 'id' | 'createdAt' | 'updatedAt'>;

// Type for registration requests (only fields that should be sent to API)
type UserRegistrationData = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export const createDealHunter = (
  overrides: Partial<UserRegistrationData> = {}
): UserRegistrationData => ({
  email: `deal.hunter.${Date.now()}@example.com`,
  password: 'SecureP@ss123',
  firstName: 'Sarah',
  lastName: 'Hunter',
  ...overrides,
});

export const createBargainSeeker = (
  overrides: Partial<UserRegistrationData> = {}
): UserRegistrationData => ({
  email: `bargain.seeker.${Date.now()}@example.com`,
  password: 'BargainHunt2024!',
  firstName: 'Marc',
  lastName: 'Discount',
  ...overrides,
});

export const createTechEnthusiast = (
  overrides: Partial<UserRegistrationData> = {}
): UserRegistrationData => ({
  email: `tech.fan.${Date.now()}@example.com`,
  password: 'TechDeals2024$',
  firstName: 'Alex',
  lastName: 'Gadget',
  ...overrides,
});
