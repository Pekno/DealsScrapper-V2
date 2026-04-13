/**
 * Admin Dashboard - E2E Tests
 *
 * Validates:
 * 1. Access control (non-admin redirect)
 * 2. Dashboard tab (service health cards, system metrics)
 * 3. Tab navigation between Dashboard and Users
 * 4. Users tab (table, search, pagination)
 * 5. User actions (role toggle, password reset, delete)
 */

import {
  API_ROUTES,
  SELECTORS,
  TEST_USERS,
  TIMEOUTS,
} from '../../support/constants';

describe('Admin Dashboard - E2E', () => {
  const adminUser = TEST_USERS.ADMIN;

  before(() => {
    // Ensure persistent users exist and all services are healthy
    cy.task('db:ensureDefaultUser');
    cy.task('db:ensureDefaultAdminUser');
    cy.waitForServices();
  });

  // -------------------------------------------------------------------------
  // Access Control
  // -------------------------------------------------------------------------

  describe('Access Control', () => {
    it('should redirect non-admin users away from /admin', () => {
      // Use the persistent default user (non-admin)
      cy.login(TEST_USERS.DEFAULT.email, TEST_USERS.DEFAULT.password);

      // Attempt to visit admin page
      cy.visit('/admin');

      // Should be redirected away from /admin (to /filters or /login)
      cy.url({ timeout: TIMEOUTS.PAGE_TRANSITION }).should(
        'not.include',
        '/admin'
      );

      // Admin dashboard content should not be visible
      cy.get(SELECTORS.ADMIN.DASHBOARD_CONTENT).should('not.exist');

      cy.task('log', '✅ Non-admin user correctly redirected from /admin');
    });

    it('should allow admin users to access /admin', () => {
      cy.loginAsAdmin(adminUser.email, adminUser.password);
      cy.visit('/admin');

      // Should stay on admin page
      cy.url({ timeout: TIMEOUTS.PAGE_TRANSITION }).should('include', '/admin');

      // Dashboard content should be visible (default tab)
      cy.get(SELECTORS.ADMIN.TAB_DASHBOARD, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      cy.task('log', '✅ Admin user can access /admin dashboard');
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard Tab
  // -------------------------------------------------------------------------

  describe('Dashboard Tab', () => {
    beforeEach(() => {
      cy.loginAsAdmin(adminUser.email, adminUser.password);

      // Intercept per-service health APIs
      cy.intercept('GET', API_ROUTES.ADMIN_HEALTH_API).as('healthApiRequest');
      cy.intercept('GET', API_ROUTES.ADMIN_HEALTH_NOTIFIER).as(
        'healthNotifierRequest'
      );
      cy.intercept('GET', API_ROUTES.ADMIN_HEALTH_SCHEDULER).as(
        'healthSchedulerRequest'
      );
      cy.intercept('GET', API_ROUTES.ADMIN_METRICS).as('metricsRequest');

      // Ensure we're on the dashboard tab and auth has resolved
      cy.visit('/admin?tab=dashboard');
      cy.get(SELECTORS.ADMIN.TAB_DASHBOARD, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');
    });

    it('should display service health cards for API, Notifier, and Scheduler', () => {
      // Wait for dashboard content to load
      cy.get(SELECTORS.ADMIN.DASHBOARD_CONTENT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Verify 3 service health cards (API, Notifier, Scheduler)
      cy.get(SELECTORS.ADMIN.SERVICE_HEALTH_CARD('api')).should('be.visible');
      cy.get(SELECTORS.ADMIN.SERVICE_HEALTH_CARD('notifier')).should(
        'be.visible'
      );
      cy.get(SELECTORS.ADMIN.SERVICE_HEALTH_CARD('scheduler')).should(
        'be.visible'
      );

      // API should always be healthy since the endpoint itself proves it
      cy.get(SELECTORS.ADMIN.SERVICE_HEALTH_CARD('api')).should(
        'contain.text',
        'healthy'
      );

      cy.task(
        'log',
        '✅ Service health cards displayed (API, Notifier, Scheduler)'
      );
    });

    it('should display system metrics section', () => {
      cy.get(SELECTORS.ADMIN.METRICS_CARD, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Verify metric cards are displayed
      cy.get(SELECTORS.ADMIN.METRIC_CARD('total-users')).should('be.visible');
      cy.get(SELECTORS.ADMIN.METRIC_CARD('total-filters')).should('be.visible');
      cy.get(SELECTORS.ADMIN.METRIC_CARD('total-matches')).should('be.visible');
      cy.get(SELECTORS.ADMIN.METRIC_CARD('active-sessions')).should(
        'be.visible'
      );

      // Metrics should contain numeric values
      cy.get(SELECTORS.ADMIN.METRIC_CARD('total-users'))
        .find(SELECTORS.ADMIN.METRIC_VALUE)
        .invoke('text')
        .should('match', /^\d/);

      cy.task('log', '✅ System metrics section is displayed with values');
    });

    it('should show scraper tiles inside the Scheduler card', () => {
      cy.get(SELECTORS.ADMIN.SERVICE_HEALTH_CARD('scheduler'), {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Wait for the scheduler health data to load (loading spinner to disappear)
      // then verify scraper worker cards are shown
      cy.get(SELECTORS.ADMIN.SERVICE_HEALTH_CARD('scheduler'))
        .find('[data-cy=scraper-worker-card]', {
          timeout: TIMEOUTS.ELEMENT_VISIBLE,
        })
        .should('have.length.greaterThan', 0);

      cy.task(
        'log',
        '✅ Scheduler card shows scraper worker tiles'
      );
    });

    it('should load cards independently via separate endpoints', () => {
      // Verify that each per-service endpoint was called
      // Accept 200 (fresh) or 304 (cached) as valid responses
      cy.wait('@healthApiRequest')
        .its('response.statusCode')
        .should('be.oneOf', [200, 304]);
      cy.wait('@healthNotifierRequest')
        .its('response.statusCode')
        .should('be.oneOf', [200, 304]);
      cy.wait('@healthSchedulerRequest')
        .its('response.statusCode')
        .should('be.oneOf', [200, 304]);
      cy.wait('@metricsRequest')
        .its('response.statusCode')
        .should('be.oneOf', [200, 304]);

      cy.task('log', '✅ Each card loads independently via separate API calls');
    });
  });

  // -------------------------------------------------------------------------
  // Tab Navigation
  // -------------------------------------------------------------------------

  describe('Tab Navigation', () => {
    beforeEach(() => {
      cy.loginAsAdmin(adminUser.email, adminUser.password);
    });

    it('should switch between Dashboard and Users tabs', () => {
      cy.visit('/admin?tab=dashboard');

      // Wait for admin page to fully load (auth resolved)
      cy.get(SELECTORS.ADMIN.TAB_DASHBOARD, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Dashboard tab should be active
      cy.get(SELECTORS.ADMIN.TAB_DASHBOARD).should(
        'have.attr',
        'aria-current',
        'page'
      );
      cy.get(SELECTORS.ADMIN.DASHBOARD_CONTENT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Click Users tab - verify by checking the users content loads
      cy.get(SELECTORS.ADMIN.TAB_USERS).click();

      // Users tab should now be active
      cy.get(SELECTORS.ADMIN.TAB_USERS, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('have.attr', 'aria-current', 'page');
      cy.get(SELECTORS.ADMIN.USERS_CONTENT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // URL should reflect tab change
      cy.url().should('include', 'tab=users');

      // Switch back to Dashboard
      cy.get(SELECTORS.ADMIN.TAB_DASHBOARD).click();
      cy.get(SELECTORS.ADMIN.DASHBOARD_CONTENT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');
      cy.url().should('include', 'tab=dashboard');

      cy.task('log', '✅ Tab navigation works correctly');
    });

    it('should preserve tab state via URL params', () => {
      // Navigate directly to Users tab via URL
      cy.visit('/admin?tab=users');

      // Wait for admin page to fully load (auth resolved)
      cy.get(SELECTORS.ADMIN.TAB_USERS, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      cy.get(SELECTORS.ADMIN.TAB_USERS).should(
        'have.attr',
        'aria-current',
        'page'
      );
      cy.get(SELECTORS.ADMIN.USERS_CONTENT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      cy.task('log', '✅ Tab state is preserved via URL params');
    });
  });

  // -------------------------------------------------------------------------
  // Users Tab
  // -------------------------------------------------------------------------

  describe('Users Tab', () => {
    beforeEach(() => {
      cy.loginAsAdmin(adminUser.email, adminUser.password);

      // Intercept the profile request so we can wait for auth to fully hydrate
      // before checking for admin-only UI elements. Note: getProfile() hits
      // /users/profile (not /users/me which is the update endpoint).
      cy.intercept('GET', API_ROUTES.USER_PROFILE).as('authProfile');
      cy.visit('/admin?tab=users');
      cy.wait('@authProfile');

      // Wait for auth to fully resolve — the tab nav only renders after auth
      cy.get(SELECTORS.ADMIN.TAB_USERS, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible').and('not.be.disabled');

      cy.get(SELECTORS.ADMIN.USER_TABLE, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');
    });

    it('should display user table with columns', () => {
      cy.get(SELECTORS.ADMIN.USER_TABLE, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Verify table headers
      cy.get(SELECTORS.ADMIN.USER_TABLE).within(() => {
        cy.get('thead th').should('have.length', 6);
        cy.get('thead').should('contain.text', 'Email');
        cy.get('thead').should('contain.text', 'Name');
        cy.get('thead').should('contain.text', 'Role');
        cy.get('thead').should('contain.text', 'Verified');
        cy.get('thead').should('contain.text', 'Last Login');
        cy.get('thead').should('contain.text', 'Actions');
      });

      cy.task('log', '✅ User table is displayed with all columns');
    });

    it('should show admin user in the table', () => {
      // The admin user we logged in as should be in the table
      cy.get(SELECTORS.ADMIN.USER_ROW(adminUser.email)).should('be.visible');
      cy.get(SELECTORS.ADMIN.USER_ROW(adminUser.email)).should(
        'contain.text',
        'ADMIN'
      );

      cy.task('log', '✅ Admin user is visible in the user table');
    });

    it('should filter users via search', () => {
      // Type in the search input
      cy.get(SELECTORS.ADMIN.USER_SEARCH)
        .should('be.visible')
        .type(TEST_USERS.DEFAULT.email);

      // Wait for the matching user to appear in the table (debounced search)
      cy.get(SELECTORS.ADMIN.USER_ROW(TEST_USERS.DEFAULT.email), {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Clear search and verify table refreshes
      cy.get(SELECTORS.ADMIN.USER_SEARCH).clear();

      // After clearing, the admin user should be visible again
      cy.get(SELECTORS.ADMIN.USER_ROW(adminUser.email), {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      cy.task('log', '✅ User search filtering works correctly');
    });
  });

  // -------------------------------------------------------------------------
  // User Actions
  // -------------------------------------------------------------------------

  describe('User Actions', () => {
    let targetUser: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };

    beforeEach(() => {
      // Create a fresh target user for each test (these get modified/deleted by tests)
      const ts = Date.now();
      targetUser = {
        email: `target.user.${ts}@example.com`,
        password: 'TargetP@ssw0rd123!',
        firstName: 'Target',
        lastName: 'UserActions',
      };

      cy.task('db:createTestUser', {
        ...targetUser,
        emailVerified: true,
      });

      // Use persistent admin user for login
      cy.loginAsAdmin(adminUser.email, adminUser.password);

      cy.visit('/admin?tab=users');

      // Wait for admin page to fully load (auth resolved) and users data to render
      cy.get(SELECTORS.ADMIN.TAB_USERS, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      cy.get(SELECTORS.ADMIN.USER_TABLE, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');
    });

    it('should toggle user role from USER to ADMIN', () => {
      // Open actions dropdown for the target user
      cy.get(SELECTORS.ADMIN.USER_ACTIONS(targetUser.email)).click();

      // Click "Set as ADMIN"
      cy.get(SELECTORS.ADMIN.ACTION_TOGGLE_ROLE)
        .should('be.visible')
        .should('contain.text', 'Set as ADMIN')
        .click();

      // Toast appears immediately on API success – check it before it auto-dismisses (5s)
      cy.get(SELECTORS.TOAST.SUCCESS, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // Verify the role badge changed
      cy.get(SELECTORS.ADMIN.USER_ROW(targetUser.email)).should(
        'contain.text',
        'ADMIN'
      );

      cy.task('log', '✅ User role toggled from USER to ADMIN');
    });

    it('should open and cancel reset password modal', () => {
      // Open actions dropdown
      cy.get(SELECTORS.ADMIN.USER_ACTIONS(targetUser.email)).click();

      // Click "Reset Password"
      cy.get(SELECTORS.ADMIN.ACTION_RESET_PASSWORD)
        .should('be.visible')
        .click();

      // Modal should be open with confirmation message
      cy.contains('Confirm Password Reset').should('be.visible');
      cy.contains(targetUser.email).should('be.visible');

      // Cancel
      cy.get(SELECTORS.ADMIN.RESET_PASSWORD_CANCEL).click();

      // Modal should be closed
      cy.contains('Confirm Password Reset').should('not.exist');

      cy.task('log', '✅ Reset password modal opens and can be cancelled');
    });

    it('should reset user password and send email notification to user', () => {
      cy.intercept('POST', API_ROUTES.ADMIN_USER_RESET_PASSWORD).as(
        'resetPasswordRequest'
      );

      // Open actions dropdown
      cy.get(SELECTORS.ADMIN.USER_ACTIONS(targetUser.email)).click();

      // Click "Reset Password"
      cy.get(SELECTORS.ADMIN.ACTION_RESET_PASSWORD)
        .should('be.visible')
        .click();

      // Confirm reset
      cy.get(SELECTORS.ADMIN.RESET_PASSWORD_CONFIRM)
        .should('be.visible')
        .click();

      // Wait for API call and verify success response
      cy.wait('@resetPasswordRequest').then((interception) => {
        expect(interception.response?.statusCode).to.eq(200);
        expect(interception.response?.body?.success).to.be.true;
        expect(interception.response?.body?.message).to.eq(
          'Password reset link sent to user'
        );
      });

      // Verify the target user received the password reset email in MailHog
      cy.waitForEmail(
        targetUser.email,
        'Reset your DealScrapper password',
        30000
      ).then((email) => {
        // Confirm the email was sent to the target user, not the admin
        const recipients: string[] = (email.To ?? []).map(
          (to: { Mailbox: string; Domain: string }) => `${to.Mailbox}@${to.Domain}`
        );
        expect(recipients).to.include(targetUser.email);
        expect(recipients).not.to.include(adminUser.email);

        cy.getResetLinkFromEmail(email).then((resetUrl) => {
          expect(resetUrl).to.include('reset-password');
        });

        cy.task('log', `✅ Password reset email delivered to ${targetUser.email}`);
      });

      cy.task(
        'log',
        '✅ Password reset triggers email notification to user'
      );
    });

    it('should show reset URL to admin when no email provider is configured', () => {
      cy.intercept('POST', API_ROUTES.ADMIN_USER_RESET_PASSWORD, {
        statusCode: 200,
        body: {
          success: true,
          data: { resetUrl: 'http://localhost:3000/auth/reset-password?token=test-token-123' },
          message: 'No email provider configured — share this link with the user',
        },
      }).as('resetPasswordNoEmail');

      // Open actions dropdown
      cy.get(SELECTORS.ADMIN.USER_ACTIONS(targetUser.email)).click();

      // Click "Reset Password"
      cy.get(SELECTORS.ADMIN.ACTION_RESET_PASSWORD)
        .should('be.visible')
        .click();

      // Confirm reset
      cy.get(SELECTORS.ADMIN.RESET_PASSWORD_CONFIRM)
        .should('be.visible')
        .click();

      // Wait for stubbed API response
      cy.wait('@resetPasswordNoEmail');

      // The reset URL should be shown to the admin
      cy.get(SELECTORS.ADMIN.RESET_URL)
        .should('be.visible')
        .should('contain', 'http://localhost:3000/auth/reset-password?token=test-token-123');

      // Copy button should be visible
      cy.get(SELECTORS.ADMIN.COPY_RESET_URL).should('be.visible');

      // Dismiss the modal
      cy.get(SELECTORS.ADMIN.RESET_PASSWORD_DONE).should('be.visible').click();

      cy.task('log', '✅ Admin sees reset URL when no email provider is configured');
    });

    it('should open and cancel delete user modal', () => {
      // Open actions dropdown
      cy.get(SELECTORS.ADMIN.USER_ACTIONS(targetUser.email)).click();

      // Click "Delete User"
      cy.get(SELECTORS.ADMIN.ACTION_DELETE_USER).should('be.visible').click();

      // Delete confirmation modal should appear (uses shared DeleteConfirmationModal)
      cy.get(SELECTORS.MODAL.DELETE_CONFIRMATION).should('be.visible');
      cy.contains(targetUser.email).should('be.visible');

      // Cancel deletion
      cy.get(SELECTORS.MODAL.CANCEL_DELETE).click();

      // Modal should be closed
      cy.get(SELECTORS.MODAL.DELETE_CONFIRMATION).should('not.exist');

      cy.task('log', '✅ Delete user modal opens and can be cancelled');
    });

    it('should delete a user', () => {
      // Open actions dropdown
      cy.get(SELECTORS.ADMIN.USER_ACTIONS(targetUser.email)).click();

      // Click "Delete User"
      cy.get(SELECTORS.ADMIN.ACTION_DELETE_USER).should('be.visible').click();

      // Confirm deletion
      cy.get(SELECTORS.MODAL.CONFIRM_DELETE).click();

      // Toast appears immediately on API success – check it before it auto-dismisses (5s)
      cy.get(SELECTORS.TOAST.SUCCESS, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');

      // User should no longer appear in the table
      cy.get(SELECTORS.ADMIN.USER_ROW(targetUser.email)).should('not.exist');

      cy.task('log', '✅ User deleted and removed from table');
    });
  });

  // -------------------------------------------------------------------------
  // Admin Navigation Link
  // -------------------------------------------------------------------------

  describe('Admin Navigation Link', () => {
    it('should show Admin nav link for admin users', () => {
      cy.loginAsAdmin(adminUser.email, adminUser.password);

      // loginAsAdmin already leaves us on /filters with auth fully hydrated —
      // no need to re-visit (which would force a page reload and auth re-init race).
      cy.contains('a', 'Admin').should('be.visible');

      cy.task('log', '✅ Admin nav link is visible for admin users');
    });

    it('should NOT show Admin nav link for regular users', () => {
      // Use persistent default user (non-admin)
      cy.login(TEST_USERS.DEFAULT.email, TEST_USERS.DEFAULT.password);

      // The Admin nav link should NOT be visible
      cy.get('nav[aria-label="Primary navigation"]').should('be.visible');
      cy.get('nav[aria-label="Primary navigation"]')
        .contains('Admin')
        .should('not.exist');

      cy.task('log', '✅ Admin nav link is hidden for regular users');
    });
  });
});
