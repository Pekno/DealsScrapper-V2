// Import Cypress commands
import './commands';

// Import Cypress grep plugin for test filtering
import '@cypress/grep';

// Global configuration
Cypress.config('defaultCommandTimeout', 10000);

// Global hooks
beforeEach(() => {
  // Set viewport to ensure consistent testing
  cy.viewport(1280, 720);

  // Clear cookies and local storage before each test
  cy.clearCookies();
  cy.clearLocalStorage();

  // Reset database state before each test
  cy.task('db:cleanup');

  // Clear MailHog messages before each test
  cy.task('email:clearMessages');
});

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test on uncaught exceptions
  // This is useful for applications that have expected uncaught exceptions
  console.log('Uncaught exception:', err.message);

  // Don't fail on certain errors that might be expected
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes('Non-Error promise rejection captured')
  ) {
    return false;
  }

  // Fail on other uncaught exceptions
  return true;
});

// Add custom matchers or global utilities here
declare global {
  namespace Cypress {
    interface Chainable {
      // Authentication commands
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;

      // Database commands
      createTestUser(userData: any): Chainable<any>;

      // Email commands
      waitForEmail(
        recipient: string,
        subject: string,
        timeout?: number
      ): Chainable<any>;
      getVerificationLinkFromEmail(email: any): Chainable<string>;

      // Filter commands
      createFilter(filterData: any): Chainable<any>;

      // Wait for services
      waitForServices(): Chainable<void>;
    }
  }
}

export {};
