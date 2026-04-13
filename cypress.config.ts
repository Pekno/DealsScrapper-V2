import { defineConfig } from 'cypress';
import {
  cleanupDatabase,
  cleanupElasticsearch,
  ensureDefaultUser,
  ensureDefaultAdminUser,
  createTestUser,
  createAdminUser,
  disconnectDatabase,
  createTestCategories,
  createTestFilter,
  cleanupTestFilters,
} from './test/support/database-helpers';
import {
  getEmailMessages,
  clearEmailMessages,
} from './test/support/email-helpers';

export default defineConfig({
  e2e: {
    // Base URL for the web application
    baseUrl: 'http://localhost:3000',

    // Test files configuration
    specPattern: 'test/e2e/**/*.cy.ts',
    supportFile: 'test/support/e2e.ts',
    fixturesFolder: 'test/fixtures',

    // Video and screenshot configuration
    video: true,
    videoCompression: 15,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'test/screenshots',
    videosFolder: 'test/videos',

    // Viewport configuration
    viewportWidth: 1280,
    viewportHeight: 720,

    // Test configuration - increased for stability on slow CI runners (GitHub Actions)
    defaultCommandTimeout: 30000,
    requestTimeout: 20000,
    responseTimeout: 20000,
    pageLoadTimeout: 45000,
    taskTimeout: 90000, // For database and email operations

    // Environment variables
    env: {
      // Backend services
      apiUrl: 'http://localhost:3001',
      scraperUrl: 'http://localhost:3002',
      notifierUrl: 'http://localhost:3003',
      schedulerUrl: 'http://localhost:3004',

      // Test infrastructure
      mailhogUrl: 'http://localhost:8025',
      databaseUrl: 'postgresql://test:test@localhost:5433/dealscrapper_test',
      redisUrl: 'redis://localhost:6380',

      // Test configuration
      testTimeouts: {
        emailDelivery: 30000,
        serviceHealth: 10000,
        databaseOperation: 5000,
        filterMatching: 15000,
      },
    },

    // Setup and teardown
    setupNodeEvents(on, config) {
      // Grep plugin for test filtering
      require('@cypress/grep/src/plugin')(config);

      // Task for database operations
      on('task', {
        // Database helpers
        'db:cleanup': async () => {
          await cleanupDatabase();
          return null;
        },

        'db:cleanupElasticsearch': async () => {
          await cleanupElasticsearch();
          return null;
        },

        'db:ensureDefaultUser': async () => {
          const user = await ensureDefaultUser();
          return user;
        },

        'db:ensureDefaultAdminUser': async () => {
          const user = await ensureDefaultAdminUser();
          return user;
        },

        'db:createTestUser': async (userData) => {
          const user = await createTestUser(userData);
          return user;
        },

        'db:createAdminUser': async (userData) => {
          const user = await createAdminUser(userData);
          return user;
        },

        'db:createTestCategories': async () => {
          const categories = await createTestCategories();
          return categories;
        },

        'db:createTestFilter': async ({ userId, filterData }) => {
          const filter = await createTestFilter(userId, filterData);
          return filter;
        },

        'db:cleanupTestFilters': async (userEmail) => {
          await cleanupTestFilters(userEmail);
          return null;
        },

        // Email helpers
        'email:getMessages': async (recipient) => {
          const messages = await getEmailMessages(recipient);
          return messages;
        },

        'email:clearMessages': async () => {
          await clearEmailMessages();
          return null;
        },

        // Log messages from tests
        log: (message) => {
          console.log(message);
          return null;
        },
      });

      // Handle process cleanup
      on('before:run', async () => {
        console.log('🧪 Starting Cypress test run...');
      });

      on('after:run', async () => {
        console.log('🧪 Cypress test run completed, cleaning up...');
        await disconnectDatabase();
      });

      return config;
    },
  },

  // Component testing configuration (for future use)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'apps/web/src/**/*.cy.ts',
  },

  // Global configuration
  retries: {
    runMode: 2,
    openMode: 0,
  },

  // Experimental features
  experimentalStudio: true,
  experimentalWebKitSupport: true,
});
