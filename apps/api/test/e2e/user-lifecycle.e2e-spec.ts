import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@dealscrapper/database';
import { createDealHunter, createBargainSeeker } from '../factories';
import { cleanupTestData } from '../helpers/e2e-helpers';

/**
 * User Lifecycle E2E Tests
 *
 * Tests the complete journey of deal hunters from registration to active usage.
 * Focuses on business value: helping users discover and get notified about great deals.
 */
describe('Deal Hunter User Lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same validation as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        disableErrorMessages: false,
      })
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  describe('New User Onboarding', () => {
    it('allows deal hunters to join the platform and start finding deals', async () => {
      const dealHunter = createDealHunter();

      // New user discovers the platform and registers
      const registrationResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      expect(registrationResponse.body.message).toContain(
        'Registration successful'
      );
      expect(registrationResponse.body.data.user.email).toBe(dealHunter.email);
      expect(registrationResponse.body.data.user.emailVerified).toBe(false);
    });

    it('allows re-registration for unverified emails but prevents it for verified emails', async () => {
      const dealHunter = createDealHunter();

      // First registration succeeds (unverified)
      const firstRegistration = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      const userId = firstRegistration.body.data.user.id;
      expect(firstRegistration.body.data.user.emailVerified).toBe(false);

      // Second registration with same email succeeds (re-registration allowed for unverified)
      const newPassword = 'NewPassword456!';
      const reRegistration = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...dealHunter,
          password: newPassword,
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(201);

      // Should be same user ID (updated, not new user created)
      expect(reRegistration.body.data.user.id).toBe(userId);
      expect(reRegistration.body.data.user.emailVerified).toBe(false);

      // Now verify the email
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });

      // Third registration with verified email should fail
      const duplicateResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...dealHunter,
          password: 'ThirdPassword789!',
        })
        .expect(409);

      expect(duplicateResponse.body.message).toContain('already exists');
    });

    it('requires strong passwords to protect user accounts', async () => {
      const dealHunter = createDealHunter({ password: 'weak' });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(400);

      // API returns an array of specific validation messages
      expect(Array.isArray(response.body.message)).toBe(true);
      expect(
        response.body.message.some((msg: string) =>
          msg.toLowerCase().includes('password')
        )
      ).toBe(true);
    });
  });

  describe('Email Verification for Account Security', () => {
    it('requires email verification before allowing login', async () => {
      const dealHunter = createDealHunter();

      // Register but don't verify email
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      // Login is blocked for unverified users (security requirement)
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: dealHunter.email,
          password: dealHunter.password,
        })
        .expect(401);

      // Verify error message guides user to verify email
      expect(loginResponse.body.message).toContain('verify your email');
    });

    it('allows verified users to access all deal hunting features', async () => {
      const dealHunter = createDealHunter();

      // Register user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      // Manually verify email (simulating email verification flow)
      await prisma.user.update({
        where: { email: dealHunter.email },
        data: { emailVerified: true },
      });

      // Verified user can now login and access features
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: dealHunter.email,
          password: dealHunter.password,
        })
        .expect(200);

      expect(loginResponse.body.data.access_token).toBeDefined();
      expect(loginResponse.body.data.user.emailVerified).toBe(true);
    });
  });

  describe('User Authentication for Personalized Deal Hunting', () => {
    it('provides secure access tokens for authenticated deal hunters', async () => {
      const dealHunter = createDealHunter();

      // Complete registration and verification
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      await prisma.user.update({
        where: { email: dealHunter.email },
        data: { emailVerified: true },
      });

      // Login provides JWT token for API access
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: dealHunter.email,
          password: dealHunter.password,
        })
        .expect(200);

      const token = loginResponse.body.data.access_token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Token allows access to protected deal hunting features
      const profileResponse = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.data.email).toBe(dealHunter.email);
      expect(profileResponse.body.data.firstName).toBe(dealHunter.firstName);
    });

    it('rejects invalid login credentials to protect accounts', async () => {
      const dealHunter = createDealHunter();

      // Register and verify user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      await prisma.user.update({
        where: { email: dealHunter.email },
        data: { emailVerified: true },
      });

      // Wrong password fails
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: dealHunter.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      // Wrong email fails
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrong@email.com',
          password: dealHunter.password,
        })
        .expect(401);
    });
  });

  describe('Account Management for Deal Hunters', () => {
    it('allows users to update their profile for better deal personalization', async () => {
      const dealHunter = createDealHunter();

      // Setup authenticated user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dealHunter)
        .expect(201);

      await prisma.user.update({
        where: { email: dealHunter.email },
        data: { emailVerified: true },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: dealHunter.email,
          password: dealHunter.password,
        })
        .expect(200);

      const token = loginResponse.body.data.access_token;

      // User updates profile for better deal matching
      const updatedProfile = {
        firstName: 'SuperSarah',
        lastName: 'DealMaster',
      };

      const updateResponse = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updatedProfile)
        .expect(200);

      expect(updateResponse.body.data.firstName).toBe('SuperSarah');
      expect(updateResponse.body.data.lastName).toBe('DealMaster');
      expect(updateResponse.body.data.email).toBe(dealHunter.email); // Email unchanged
    });
  });
});
