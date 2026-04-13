/**
 * Authentication Flow - Complete E2E Test
 *
 * Based on the original Jest E2E tests, this validates:
 * 1. User registration through web forms
 * 2. Email verification via MailHog integration
 * 3. Login/logout workflows
 * 4. Error handling for edge cases
 * 5. Forgot password and reset password flows
 *
 * This replaces the Jest tests with real browser interaction
 */

import { API_ROUTES, SELECTORS, TIMEOUTS } from '../../support/constants';

describe('Authentication Flow - Complete E2E', () => {
  let testUser: any;

  before(() => {
    // Ensure all services are healthy before starting
    cy.waitForServices();
  });

  beforeEach(() => {
    // Generate unique test user for each test
    testUser = {
      email: `test.user.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    cy.task('log', `🧪 Starting test with user: ${testUser.email}`);
  });

  describe('User Registration and Email Verification', () => {
    it('should complete full registration and email verification flow', () => {
      cy.task(
        'log',
        '🧪 Testing complete registration and email verification workflow...'
      );

      // Step 1: Visit registration page
      cy.visit('/register');
      cy.url().should('include', '/register');
      cy.intercept('POST', '**/auth/register').as('registration');

      // Step 2: Fill registration form
      cy.get('[data-cy=first-name-input]')
        .should('be.visible')
        .clear()
        .type(testUser.firstName);

      cy.get('[data-cy=last-name-input]')
        .should('be.visible')
        .clear()
        .type(testUser.lastName);

      cy.get('[data-cy=email-input]')
        .should('be.visible')
        .clear()
        .type(testUser.email);

      cy.get('[data-cy=password-input]')
        .should('be.visible')
        .clear()
        .type(testUser.password);

      cy.get('[data-cy=confirm-password-input]')
        .should('be.visible')
        .clear()
        .type(testUser.password);

      // Step 3: Accept terms and submit registration
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      // Step 4: Verify registration success
      cy.wait('@registration');
      cy.get('[data-cy=registration-success]')
        .should('be.visible')
        .should('contain.text', 'Registration successful');

      // Step 5: Should redirect to email verification page
      cy.url().should('include', '/verify-email');

      cy.get('[data-cy=verification-message]').should('be.visible');

      cy.get('[data-cy=verification-email]')
        .should('be.visible')
        .should('contain.text', testUser.email);

      // Step 6: Wait for verification email and complete verification process
      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        (email) => {
          // Verify email content
          const subject = email.Content.Headers.Subject[0];
          expect(subject).to.satisfy(
            (subj: string) =>
              subj.includes('Verify_your_email_address') ||
              subj.includes('Verify your email address') ||
              subj.includes('email_address')
          );
          expect(email.Content.Body).to.contain(testUser.email);
          expect(email.Content.Body).to.contain('DealScrapper');
          expect(email.From.Mailbox).to.satisfy(
            (mailbox: string) =>
              mailbox.includes('test') || mailbox.includes('dealscrapper')
          );

          cy.task('log', '✅ Verification email received and validated');

          // Step 7: Extract verification URL and complete verification
          cy.getVerificationLinkFromEmail(email).then((verificationUrl) => {
            // Visit verification URL
            cy.visit(verificationUrl);

            // Verify successful verification page
            cy.get('[data-cy=verification-success]', { timeout: 15000 })
              .should('be.visible')
              .should('contain.text', 'Email verified successfully');

            // Should offer login option
            cy.get('[data-cy=login-link]')
              .should('be.visible')
              .should('contain.text', 'Login');

            cy.task(
              'log',
              '✅ Complete registration and email verification flow successful'
            );
          });
        }
      );
    });

    it('should allow verified user to login successfully', () => {
      cy.task('log', '🧪 Testing verified user login...');

      // Step 1: Complete registration and verification (setup)
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      // Complete verification
      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        (email) => {
          cy.getVerificationLinkFromEmail(email).then((verificationUrl) => {
            cy.visit(verificationUrl);
            cy.get('[data-cy=verification-success]', { timeout: 15000 }).should(
              'be.visible'
            );

            // Step 2: Now test login
            cy.visit('/login');

            cy.get('[data-cy=email-input]')
              .should('be.visible')
              .type(testUser.email);

            cy.get('[data-cy=password-input]')
              .should('be.visible')
              .type(testUser.password);

            cy.get('[data-cy=login-submit]').click();

            // Step 3: Verify successful login
            cy.url({ timeout: 15000 }).should('include', '/filters');

            // Verify user is logged in
            cy.get('[data-cy=user-menu]').should(
              'be.visible'
            );

            // Step 4: Verify user information is accessible
            // Verify email is displayed with proper ellipsis handling
            cy.get('[data-cy=user-email]')
              .should('be.visible')
              .should('have.attr', 'title', testUser.email) // Full email in title tooltip
              .invoke('text')
              .should('not.be.empty'); // Has text (may be truncated with ellipsis)

            cy.task('log', '✅ Verified user login successful');
          });
        }
      );
    });

    it('should prevent login with unverified email', () => {
      cy.task('log', '🧪 Testing unverified user login prevention...');

      // Step 1: Intercept registration as success
      cy.intercept('POST', '**/auth/register').as('registration');

      // Register but don't verify
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      // Wait for registration to complete
      cy.wait('@registration');
      cy.get('[data-cy=registration-success]').should('be.visible');

      // Step 2: Intercept login attempt with unverified email error
      cy.intercept('POST', '**/auth/login').as('loginAttempt');

      // Attempt login without verification
      cy.visit('/login');
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=login-submit]').click();

      // Wait for login attempt to fail
      cy.wait('@loginAttempt');
      cy.get('[data-cy=login-error]')
        .should('be.visible')
        .should('contain.text', 'Please verify your email');

      // Should remain on login page
      cy.url().should('include', '/login');

      cy.task('log', '✅ Unverified user login prevented correctly');
    });
  });

  describe('Re-registration and Email Resend', () => {
    it('should allow re-registration for unverified email and resend verification', () => {
      cy.task('log', '🧪 Testing re-registration for unverified email...');

      // Step 1: Register user first time
      cy.intercept('POST', '**/auth/register').as('firstRegistration');
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      cy.wait('@firstRegistration');
      cy.get('[data-cy=registration-success]').should('be.visible');
      cy.url().should('include', '/verify-email');

      // Step 2: Don't verify - try to register again with same email (simulating lost email)
      const newPassword = 'NewPassword456!';
      cy.intercept('POST', '**/auth/register').as('reRegistration');
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type('Updated');
      cy.get('[data-cy=last-name-input]').type('Name');
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(newPassword);
      cy.get('[data-cy=confirm-password-input]').type(newPassword);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      // Step 3: Should succeed (re-registration allowed for unverified emails)
      cy.wait('@reRegistration');
      cy.get('[data-cy=registration-success]').should('be.visible');
      cy.url().should('include', '/verify-email');

      // Step 4: Verify new verification email is sent
      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        (email) => {
          expect(email.Content.Body).to.contain(testUser.email);
          cy.task(
            'log',
            '✅ Re-registration for unverified email successful with new verification email sent'
          );
        }
      );
    });

    it('should reject re-registration for verified email', () => {
      cy.task('log', '🧪 Testing re-registration rejection for verified email...');

      // Step 1: Register and verify user
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      // Complete email verification
      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        (email) => {
          cy.getVerificationLinkFromEmail(email).then((verificationUrl) => {
            cy.visit(verificationUrl);
            cy.get('[data-cy=verification-success]', { timeout: 15000 }).should(
              'be.visible'
            );

            // Log out before trying to register again
            cy.clearCookies();
            cy.clearLocalStorage();

            // Step 2: Try to register with same verified email
            cy.intercept('POST', '**/auth/register').as('duplicateRegistration');
            cy.visit('/register');
            cy.get('[data-cy=first-name-input]').type('Different');
            cy.get('[data-cy=last-name-input]').type('Name');
            cy.get('[data-cy=email-input]').type(testUser.email);
            cy.get('[data-cy=password-input]').type('NewPassword789!');
            cy.get('[data-cy=confirm-password-input]').type('NewPassword789!');
            cy.get('[data-cy=terms-checkbox]').check();
            cy.get('[data-cy=register-submit]').click();

            // Step 3: Should fail - verified emails cannot be re-registered
            cy.wait('@duplicateRegistration');
            cy.get('[data-cy=registration-error]')
              .should('be.visible')
              .should('contain.text', 'email already exists');

            cy.task(
              'log',
              '✅ Re-registration for verified email correctly rejected'
            );
          });
        }
      );
    });

    it('should allow resending verification email from verify-email page', () => {
      cy.task('log', '🧪 Testing resend verification email button...');

      // Step 1: Register user
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      // Step 2: Should redirect to verify-email page
      cy.url().should('include', '/verify-email');
      cy.get('[data-cy=verification-email]').should('contain.text', testUser.email);

      // Step 3: Wait for initial verification email
      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        () => {
          // Step 4: Click resend button
          cy.intercept('POST', '**/auth/resend-verification').as('resendEmail');
          cy.get('[data-cy=resend-verification-button]').should('be.visible').click();

          // Step 5: Verify resend API call was made
          cy.wait('@resendEmail');

          // Step 6: Verify success message is shown
          cy.get('[data-cy=resend-success-message]')
            .should('be.visible')
            .should('contain.text', 'Verification email sent');

          // Step 7: Verify second email is received
          cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
            (email) => {
              expect(email.Content.Body).to.contain(testUser.email);
              cy.task('log', '✅ Resend verification email successful');
            }
          );
        }
      );
    });

    it('should enforce 60-second cooldown on resend button', () => {
      cy.task('log', '🧪 Testing resend button cooldown behavior...');

      // Step 1: Register user and get to verify-email page
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      cy.url().should('include', '/verify-email');

      // Step 2: Click resend button
      cy.intercept('POST', '**/auth/resend-verification').as('resendEmail');
      cy.get('[data-cy=resend-verification-button]').should('be.visible').click();
      cy.wait('@resendEmail');

      // Step 3: Verify button is disabled after click
      cy.get('[data-cy=resend-verification-button]')
        .should('be.disabled')
        .should('contain.text', 'Resend in');

      // Step 4: Wait a few seconds and verify button still disabled
      cy.wait(3000); // Wait 3 seconds
      cy.get('[data-cy=resend-verification-button]').should('be.disabled');

      cy.task('log', '✅ Resend button cooldown working correctly');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle duplicate email registration for verified accounts', () => {
      cy.task('log', '🧪 Testing duplicate email registration for verified accounts...');

      // Step 1: Register and verify user
      cy.intercept('POST', '**/auth/register').as('firstRegistration');
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(testUser.firstName);
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      cy.wait('@firstRegistration');
      cy.get('[data-cy=registration-success]').should('be.visible');

      // Complete verification
      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        (email) => {
          cy.getVerificationLinkFromEmail(email).then((verificationUrl) => {
            cy.visit(verificationUrl);
            cy.get('[data-cy=verification-success]', { timeout: 15000 }).should(
              'be.visible'
            );

            // Log out before trying to register again
            cy.clearCookies();
            cy.clearLocalStorage();

            // Step 2: Try to register with verified email again
            cy.intercept('POST', '**/auth/register').as('duplicateRegistration');
            cy.visit('/register');
            cy.get('[data-cy=first-name-input]').type('Different');
            cy.get('[data-cy=last-name-input]').type('Name');
            cy.get('[data-cy=email-input]').type(testUser.email);
            cy.get('[data-cy=password-input]').type(testUser.password);
            cy.get('[data-cy=confirm-password-input]').type(testUser.password);
            cy.get('[data-cy=terms-checkbox]').check();
            cy.get('[data-cy=register-submit]').click();

            // Step 3: Should show error for verified email
            cy.wait('@duplicateRegistration');
            cy.get('[data-cy=registration-error]')
              .should('be.visible')
              .should('contain.text', 'email already exists');

            cy.task('log', '✅ Duplicate verified email registration handled correctly');
          });
        }
      );
    });

    it('should handle invalid login credentials', () => {
      cy.task('log', '🧪 Testing invalid login credentials...');

      // Intercept the login API call and stub the error response
      cy.intercept('POST', '**/auth/login').as('loginRequest');

      // Test wrong email
      cy.visit('/login');
      cy.get('[data-cy=email-input]').type('nonexistent@example.com');
      cy.get('[data-cy=password-input]').type('WrongPassword123!');
      cy.get('[data-cy=login-submit]').click();

      // Wait for the API call to complete
      cy.wait('@loginRequest');

      // Now verify the error state is displayed
      cy.get('[data-cy=login-error]')
        .should('be.visible')
        .should('contain.text', 'Invalid credentials');

      cy.task('log', '✅ Invalid credentials handled correctly');
    });

    it('should handle invalid email verification token', () => {
      cy.task('log', '🧪 Testing invalid verification token...');

      // Intercept the verify-email API call and stub the error response
      cy.intercept('GET', '**/auth/verify-email?token=invalid-token-12345').as(
        'verifyEmail'
      );

      // Visit verification page with invalid token
      cy.visit('/verify-email/confirm?token=invalid-token-12345');

      // Wait for the API call to complete
      cy.wait('@verifyEmail');

      // Now verify the error state is displayed
      cy.get('[data-cy=verification-error]')
        .should('be.visible')
        .should('contain.text', 'Invalid verification token');

      cy.task('log', '✅ Invalid verification token handled correctly');
    });

    it('should redirect when accessing verification page without token', () => {
      cy.task(
        'log',
        '🧪 Testing direct access to verification confirm page...'
      );

      // Visit verification page without token
      cy.visit('/verify-email/confirm');

      // Should redirect to login page
      cy.url().should('include', '/login');

      cy.task(
        'log',
        '✅ Direct access to verification page redirected correctly'
      );
    });

    it('should handle weak password validation', () => {
      cy.task('log', '🧪 Testing password validation...');

      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(
        testUser.firstName
      );
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);

      // Try weak password
      cy.get('[data-cy=password-input]').type('weak');
      cy.get('[data-cy=confirm-password-input]').type('weak');
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      cy.get('[data-cy=registration-error]')
        .should('be.visible')
        .should('contain.text', 'Password must');

      cy.task('log', '✅ Password validation working correctly');
    });

    it('should handle password mismatch', () => {
      cy.task('log', '🧪 Testing password confirmation mismatch...');

      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(
        testUser.firstName
      );
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type('DifferentPassword123!');
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      cy.get('[data-cy=password-mismatch-error]')
        .should('be.visible')
        .should('contain.text', 'Passwords do not match');

      cy.task('log', '✅ Password mismatch handled correctly');
    });
  });

  describe('Password Reset Flow', () => {
    it('should send reset email when user requests forgot password', () => {
      cy.task('log', '🧪 Testing forgot password email delivery...');

      const resetUser = {
        email: `reset.user.${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Reset',
        lastName: 'User',
      };

      cy.task('db:createTestUser', {
        email: resetUser.email,
        password: resetUser.password,
        firstName: resetUser.firstName,
        lastName: resetUser.lastName,
        emailVerified: true,
      });

      cy.task('email:clearMessages');

      cy.intercept('POST', API_ROUTES.FORGOT_PASSWORD).as('forgotPassword');

      cy.visit('/auth/forgot-password');

      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_EMAIL)
        .should('be.visible')
        .type(resetUser.email);

      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_SUBMIT).click();

      cy.wait('@forgotPassword');

      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_CONFIRMATION).should('be.visible');

      cy.waitForEmail(resetUser.email, 'Reset your DealScrapper password', TIMEOUTS.EMAIL_DELIVERY).then((email) => {
        const recipients: string[] = (email.To ?? []).map(
          (to: { Mailbox: string; Domain: string }) => `${to.Mailbox}@${to.Domain}`
        );
        expect(recipients).to.include(resetUser.email);
        cy.task('log', `✅ Password reset email sent to ${resetUser.email}`);
      });
    });

    it('should allow user to reset password via email link and login with new password', () => {
      cy.task('log', '🧪 Testing full password reset flow via email link...');

      const resetUser = {
        email: `reset.full.${Date.now()}@example.com`,
        password: 'OldPassword123!',
        firstName: 'Full',
        lastName: 'Reset',
      };
      const newPassword = 'NewPassword456!';

      cy.task('db:createTestUser', {
        email: resetUser.email,
        password: resetUser.password,
        firstName: resetUser.firstName,
        lastName: resetUser.lastName,
        emailVerified: true,
      });

      cy.task('email:clearMessages');

      cy.visit('/auth/forgot-password');
      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_EMAIL).type(resetUser.email);
      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_SUBMIT).click();
      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_CONFIRMATION).should('be.visible');

      cy.waitForEmail(resetUser.email, 'Reset your DealScrapper password', TIMEOUTS.EMAIL_DELIVERY).then((email) => {
        cy.getResetLinkFromEmail(email).then((resetUrl) => {
          cy.visit(resetUrl);

          cy.get(SELECTORS.PASSWORD_RESET.RESET_NEW_PASSWORD)
            .should('be.visible')
            .type(newPassword);

          cy.get(SELECTORS.PASSWORD_RESET.RESET_CONFIRM_PASSWORD)
            .should('be.visible')
            .type(newPassword);

          cy.intercept('POST', API_ROUTES.RESET_PASSWORD).as('resetPassword');
          cy.get(SELECTORS.PASSWORD_RESET.RESET_SUBMIT).click();
          cy.wait('@resetPassword');

          cy.get(SELECTORS.PASSWORD_RESET.RESET_SUCCESS).should('be.visible');

          // Login with new password
          cy.visit('/login');
          cy.get('[data-cy=email-input]').type(resetUser.email);
          cy.get('[data-cy=password-input]').type(newPassword);
          cy.get('[data-cy=login-submit]').click();

          cy.url({ timeout: TIMEOUTS.PAGE_LOAD }).should('include', '/filters');
          cy.get('[data-cy=user-menu]').should('be.visible');

          cy.task('log', '✅ Password reset via email link and login with new password successful');
        });
      });
    });

    it('should reject an already-used reset link', () => {
      cy.task('log', '🧪 Testing expired/used reset link rejection...');

      const resetUser = {
        email: `reset.used.${Date.now()}@example.com`,
        password: 'OldPassword123!',
        firstName: 'Used',
        lastName: 'Token',
      };
      const newPassword = 'NewPassword456!';

      cy.task('db:createTestUser', {
        email: resetUser.email,
        password: resetUser.password,
        firstName: resetUser.firstName,
        lastName: resetUser.lastName,
        emailVerified: true,
      });

      cy.task('email:clearMessages');

      cy.visit('/auth/forgot-password');
      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_EMAIL).type(resetUser.email);
      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_SUBMIT).click();
      cy.get(SELECTORS.PASSWORD_RESET.FORGOT_CONFIRMATION).should('be.visible');

      cy.waitForEmail(resetUser.email, 'Reset your DealScrapper password', TIMEOUTS.EMAIL_DELIVERY).then((email) => {
        cy.getResetLinkFromEmail(email).then((resetUrl) => {
          // Use the link once successfully
          cy.visit(resetUrl);
          cy.get(SELECTORS.PASSWORD_RESET.RESET_NEW_PASSWORD).type(newPassword);
          cy.get(SELECTORS.PASSWORD_RESET.RESET_CONFIRM_PASSWORD).type(newPassword);

          cy.intercept('POST', API_ROUTES.RESET_PASSWORD).as('firstReset');
          cy.get(SELECTORS.PASSWORD_RESET.RESET_SUBMIT).click();
          cy.wait('@firstReset');
          cy.get(SELECTORS.PASSWORD_RESET.RESET_SUCCESS).should('be.visible');

          // Try to use the same link a second time
          cy.visit(resetUrl);

          cy.get(SELECTORS.PASSWORD_RESET.RESET_ERROR, { timeout: TIMEOUTS.ELEMENT_VISIBLE })
            .should('be.visible');

          cy.task('log', '✅ Already-used reset link correctly rejected');
        });
      });
    });
  });

  describe('User Navigation and Logout', () => {
    it('should allow user to logout successfully', () => {
      cy.task('log', '🧪 Testing user logout...');

      // Step 1: Register, verify, and login (setup)
      cy.visit('/register');
      cy.get('[data-cy=first-name-input]').type(
        testUser.firstName
      );
      cy.get('[data-cy=last-name-input]').type(testUser.lastName);
      cy.get('[data-cy=email-input]').type(testUser.email);
      cy.get('[data-cy=password-input]').type(testUser.password);
      cy.get('[data-cy=confirm-password-input]').type(testUser.password);
      cy.get('[data-cy=terms-checkbox]').check();
      cy.get('[data-cy=register-submit]').click();

      cy.waitForEmail(testUser.email, 'Verify your email address', 30000).then(
        (email) => {
          cy.getVerificationLinkFromEmail(email).then((verificationUrl) => {
            cy.visit(verificationUrl);
            cy.get('[data-cy=verification-success]', { timeout: 15000 }).should(
              'be.visible'
            );

            // Login
            cy.visit('/login');
            cy.get('[data-cy=email-input]').type(
              testUser.email
            );
            cy.get('[data-cy=password-input]').type(testUser.password);
            cy.get('[data-cy=login-submit]').click();

            // Verify logged in
            cy.url({ timeout: 15000 }).should('include', '/filters');
            cy.get('[data-cy=user-menu]').should(
              'be.visible'
            );

            // Step 2: Test logout
            cy.get('[data-cy=user-menu]').click();
            cy.get('[data-cy=logout-button]').click();

            // Step 3: Verify logout
            cy.url().should('include', '/login');

            cy.task('log', '✅ User logout successful');
          });
        }
      );
    });
  });
});
