/**
 * Basic Connectivity Test - Cypress E2E
 *
 * Tests basic connectivity to all services without relying on specific DOM elements
 */

describe('Basic Connectivity', () => {
  it('should load the main page successfully', () => {
    // Intercept the page request to verify HTTP 200
    cy.intercept('GET', '/').as('mainPage');

    cy.visit('/');

    // Wait for page load and verify 200 status
    cy.wait('@mainPage').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
    });

    // Verify key content is present
    cy.contains('Sign In').should('be.visible');
    cy.contains('Ready to Find Your Perfect Deal?').should('be.visible');

    cy.task('log', '✅ Main page loaded successfully with HTTP 200');
  });

  it('should verify all backend services are healthy', () => {
    // Test API service
    cy.request('GET', `${Cypress.env('apiUrl')}/health/ready`).then(
      (response) => {
        expect(response.status).to.eq(200);
        cy.task('log', '✅ API service is healthy');
      }
    );

    // Test Scraper service
    cy.request('GET', `${Cypress.env('scraperUrl')}/health/ready`).then(
      (response) => {
        expect(response.status).to.eq(200);
        cy.task('log', '✅ Scraper service is healthy');
      }
    );

    // Test Notifier service
    cy.request('GET', `${Cypress.env('notifierUrl')}/health/ready`).then(
      (response) => {
        expect(response.status).to.eq(200);
        cy.task('log', '✅ Notifier service is healthy');
      }
    );

    // Test Scheduler service
    cy.request('GET', `${Cypress.env('schedulerUrl')}/health/ready`).then(
      (response) => {
        expect(response.status).to.eq(200);
        cy.task('log', '✅ Scheduler service is healthy');
      }
    );
  });

  it('should verify MailHog is accessible', () => {
    cy.request('GET', `${Cypress.env('mailhogUrl')}/api/v2/messages`).then(
      (response) => {
        expect(response.status).to.eq(200);
        cy.task('log', '✅ MailHog is accessible');
      }
    );
  });

  it('should test basic navigation if routes exist', () => {
    // Try common routes that might exist
    const routesToTest = ['/login', '/register', '/dashboard'];

    routesToTest.forEach((route) => {
      cy.request({
        url: route,
        failOnStatusCode: false, // Don't fail if route doesn't exist
      }).then((response) => {
        if (response.status === 200) {
          cy.task('log', `✅ Route ${route} exists and is accessible`);
        } else {
          cy.task(
            'log',
            `ℹ️ Route ${route} returned status ${response.status}`
          );
        }
      });
    });
  });
});
