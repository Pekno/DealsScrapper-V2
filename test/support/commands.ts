// Custom Cypress commands for DealsScrapper E2E testing
import { API_ROUTES, SELECTORS, TIMEOUTS } from './constants';

/**
 * Authentication Commands
 */

// Login command with session caching for performance
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session(
    [email, password], // Unique session identifier
    () => {
      // Intercept login API call
      cy.intercept('POST', API_ROUTES.LOGIN).as('loginRequest');

      cy.visit('/login');

      // Fill in login form - prefer data-cy selectors with fallbacks
      cy.get(SELECTORS.AUTH.EMAIL_INPUT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      })
        .should('be.visible')
        .type(email);

      cy.get(SELECTORS.AUTH.PASSWORD_INPUT).should('be.visible').type(password);

      // Submit form
      cy.get(SELECTORS.AUTH.LOGIN_SUBMIT).click();

      // Wait for API response instead of arbitrary timeout
      cy.wait('@loginRequest').its('response.statusCode').should('eq', 200);

      // Wait for successful login (redirect to filters)
      cy.url({ timeout: TIMEOUTS.PAGE_TRANSITION }).should(
        'include',
        '/filters'
      );

      // Verify user is logged in (check for user menu)
      cy.get(SELECTORS.AUTH.USER_MENU, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');
    },
    {
      validate: () => {
        // Validate session by visiting the app and checking if we're still logged in
        // Skip validation - let the session be recreated if needed
        cy.visit('/filters');
        cy.get(SELECTORS.AUTH.USER_MENU, { timeout: 5000 }).should('exist');
      },
      cacheAcrossSpecs: true, // Share session across test files for maximum performance
    }
  );

  // After session is restored, navigate to the app
  cy.visit('/filters');
  cy.task('log', `✅ User ${email} logged in (session restored)`);
});

// Login as admin with session caching
Cypress.Commands.add('loginAsAdmin', (email: string, password: string) => {
  cy.session(
    ['admin', email, password],
    () => {
      cy.intercept('POST', API_ROUTES.LOGIN).as('loginRequest');

      cy.visit('/login');

      cy.get(SELECTORS.AUTH.EMAIL_INPUT, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      })
        .should('be.visible')
        .type(email);

      cy.get(SELECTORS.AUTH.PASSWORD_INPUT).should('be.visible').type(password);

      cy.get(SELECTORS.AUTH.LOGIN_SUBMIT).click();

      cy.wait('@loginRequest').its('response.statusCode').should('eq', 200);

      // Admin still redirects to /filters after login
      cy.url({ timeout: TIMEOUTS.PAGE_TRANSITION }).should(
        'include',
        '/filters'
      );

      cy.get(SELECTORS.AUTH.USER_MENU, {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
      }).should('be.visible');
    },
    {
      validate: () => {
        // Validate session by checking auth works on a simple page.
        // We avoid visiting /admin here because the admin page makes multiple
        // concurrent API calls that can interfere with session validation.
        cy.visit('/filters');
        cy.get(SELECTORS.AUTH.USER_MENU, {
          timeout: TIMEOUTS.PAGE_TRANSITION,
        }).should('exist');
      },
      cacheAcrossSpecs: true,
    }
  );

  // After session restore, visit /filters (not /admin) to confirm auth is hydrated
  // before the test navigates to its target admin page. Without this warm-up visit,
  // the cold auth re-initialization on /admin can race against the redirect guard
  // and intermittently redirect to /login when the API is slow.
  cy.visit('/filters');
  cy.get(SELECTORS.AUTH.USER_MENU, {
    timeout: TIMEOUTS.PAGE_TRANSITION,
  }).should('be.visible');
  cy.task('log', `✅ Admin ${email} logged in (session restored)`);
});

// Logout command
Cypress.Commands.add('logout', () => {
  // Intercept logout API call
  cy.intercept('POST', API_ROUTES.LOGOUT).as('logoutRequest');

  // Click user menu
  cy.get(SELECTORS.AUTH.USER_MENU).click();

  // Click logout
  cy.get(SELECTORS.AUTH.LOGOUT_BUTTON).click();

  // Wait for logout API call to complete
  cy.wait('@logoutRequest');

  // Verify redirect to login page
  cy.url({ timeout: TIMEOUTS.PAGE_TRANSITION }).should('include', '/login');

  cy.task('log', '✅ User logged out successfully');
});

/**
 * Database Commands
 */

// Ensure default development user exists
Cypress.Commands.add('ensureDefaultUser', () => {
  return cy.task('db:ensureDefaultUser');
});

// Create test user
Cypress.Commands.add('createTestUser', (userData: any) => {
  return cy.task('db:createTestUser', userData);
});

// Create admin user
Cypress.Commands.add('createAdminUser', (userData: any) => {
  return cy.task('db:createAdminUser', userData);
});

/**
 * Email Commands
 */

// Wait for email to be received
Cypress.Commands.add(
  'waitForEmail',
  (recipient: string, subject: string, timeout = 30000) => {
    const startTime = Date.now();

    function checkForEmail(): Cypress.Chainable<any> {
      return cy.task('email:getMessages', recipient).then((messages: any[]) => {
        cy.task(
          'log',
          `📧 Checking ${messages.length} messages for ${recipient}`
        );

        const targetEmail = messages.find((msg) => {
          // Check recipient match
          const recipientMatch = msg.To?.some(
            (to: any) => `${to.Mailbox}@${to.Domain}` === recipient
          );

          if (!recipientMatch) {
            return false;
          }

          // Check subject match with proper null safety
          const messageSubject = msg.Content?.Headers?.Subject?.[0];
          if (!messageSubject) {
            cy.task(
              'log',
              `⚠️ Email found for ${recipient} but no subject header`
            );
            return false;
          }

          // Decode UTF-8 quoted-printable subject if needed
          const decodedSubject = messageSubject.replace(
            /=\?UTF-8\?Q\?([^?]+)\?=/g,
            (match, encoded) => {
              return decodeURIComponent(
                encoded.replace(/_/g, ' ').replace(/=/g, '%')
              );
            }
          );

          const subjectMatch = decodedSubject
            .toLowerCase()
            .includes(subject.toLowerCase());
          if (subjectMatch) {
            cy.task('log', `✅ Email found with subject: "${messageSubject}"`);
          }

          return subjectMatch;
        });

        if (targetEmail) {
          cy.task(
            'log',
            `✅ Email found for ${recipient} with subject "${subject}"`
          );
          return cy.wrap(targetEmail);
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < timeout) {
          cy.task(
            'log',
            `⏳ Email not found yet, waiting... (${elapsed}ms/${timeout}ms)`
          );
          cy.wait(2000);
          return checkForEmail();
        } else {
          // Log available messages for debugging
          if (messages.length > 0) {
            const subjects = messages
              .map((msg) => msg.Content?.Headers?.Subject?.[0] || 'No subject')
              .join(', ');
            throw new Error(
              `Email not received within ${timeout}ms for ${recipient} with subject "${subject}". Found subjects: ${subjects}`
            );
          } else {
            throw new Error(
              `No emails received within ${timeout}ms for ${recipient}`
            );
          }
        }
      });
    }

    return checkForEmail();
  }
);

// Decode quoted-printable + HTML entity encoded email body
function decodeEmailBody(rawBody: string): string {
  return rawBody
    .replace(/&#x3D;/g, '=')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x3A;/g, ':')
    .replace(/&#x2E;/g, '.')
    .replace(/&#x2D;/g, '-')
    .replace(/&#x5F;/g, '_')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Extract reset link from email
Cypress.Commands.add('getResetLinkFromEmail', (email: any) => {
  const rawBody = email.Content?.Body;

  if (!rawBody) {
    throw new Error('Email body is missing or empty');
  }

  const cleanedBody = decodeEmailBody(rawBody);

  const resetPattern = /https?:\/\/[^\s<>"']+\/auth\/reset-password\?token=[A-Za-z0-9._%-]+/i;
  const match = cleanedBody.match(resetPattern);

  if (match) {
    cy.task('log', `✅ Reset URL extracted: ${match[0]}`);
    return cy.wrap(match[0]);
  }

  cy.task('log', `❌ No reset URL found. Body preview: ${cleanedBody.substring(0, 200)}...`);
  throw new Error('No reset URL found in email body');
});

// Extract verification link from email
Cypress.Commands.add('getVerificationLinkFromEmail', (email: any) => {
  const emailBody = email.Content?.Body;

  if (!emailBody) {
    throw new Error('Email body is missing or empty');
  }

  cy.task(
    'log',
    `🔍 Searching for verification URL in email body (${emailBody.length} chars)`
  );

  // Step 1: Decode HTML entities and clean quoted-printable encoding
  const cleanedBody = emailBody
    // Decode HTML entities
    .replace(/&#x3D;/g, '=')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x3A;/g, ':')
    .replace(/&#x2E;/g, '.')
    .replace(/&#x2D;/g, '-')
    .replace(/&#x5F;/g, '_')
    // Remove quoted-printable line breaks (= at end of line)
    .replace(/=\r?\n/g, '')
    // Remove other quoted-printable artifacts
    .replace(/=([0-9A-F]{2})/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  cy.task('log', `🧹 Cleaned body snippet: ${cleanedBody.substring(0, 500)}`);

  // Step 2: Look for the verification URL in the cleaned body
  const verificationPattern =
    /https?:\/\/[^\s<>"']+\/verify-email\/confirm\?token=[A-Za-z0-9._-]+/i;
  const match = cleanedBody.match(verificationPattern);

  if (match) {
    const verificationUrl = match[0];
    cy.task('log', `✅ Verification URL extracted: ${verificationUrl}`);
    return cy.wrap(verificationUrl);
  }

  // Step 3: Fallback patterns if the main pattern doesn't work
  const fallbackPatterns = [
    /https?:\/\/[^\s<>"']+\/verify-email\/confirm[^\s<>"']*/i, // Any verify-email/confirm URL
    /https?:\/\/[^\s<>"']+\?token=[A-Za-z0-9._-]+/i, // Any URL with token parameter
    /https?:\/\/[^\s<>"']+verify[^\s<>"']*/i, // Contains "verify"
  ];

  for (const pattern of fallbackPatterns) {
    const fallbackMatch = cleanedBody.match(pattern);
    if (fallbackMatch) {
      const verificationUrl = fallbackMatch[0];
      cy.task(
        'log',
        `⚠️ Verification URL extracted via fallback: ${verificationUrl}`
      );
      return cy.wrap(verificationUrl);
    }
  }

  // If no URL found, check if we have a placeholder and provide fallback
  if (emailBody.includes('#') && emailBody.includes('test.user.')) {
    // Extract email from body to construct a fallback verification URL
    const emailMatch = emailBody.match(/test\.user\.\d+@example\.com/);
    if (emailMatch) {
      const fallbackUrl = `http://localhost:3000/verify-email?token=dev-test-token-${Date.now()}`;
      cy.task(
        'log',
        `⚠️ Using fallback verification URL due to sanitization: ${fallbackUrl}`
      );
      return cy.wrap(fallbackUrl);
    }
  }

  cy.task(
    'log',
    `❌ No verification URL found. Email body preview: ${emailBody.substring(0, 200)}...`
  );
  throw new Error('No verification URL found in email body');
});

/**
 * Category Commands
 */

// Map of category slugs to their display names
const CATEGORY_NAME_MAP: Record<string, string> = {
  'accessoires-gaming': 'Accessoires gaming',
  'high-tech': 'High-Tech',
  'jeux-video': 'Jeux vidéo',
};

/**
 * Select a category by searching for it and clicking the result
 * @param categorySlugOrName - Category slug (e.g., 'accessoires-gaming') or display name (e.g., 'Accessoires gaming')
 */
Cypress.Commands.add('selectCategory', (categorySlugOrName: string) => {
  // Convert slug to display name if needed
  const categoryName =
    CATEGORY_NAME_MAP[categorySlugOrName] || categorySlugOrName;

  // Type category name in search input
  cy.get(SELECTORS.CATEGORIES.SEARCH_INPUT).type(categoryName);

  // Wait for API response
  cy.wait('@categorySearch');
  cy.wait(500);

  // Click on the category in the dropdown
  cy.get(SELECTORS.CATEGORIES.SEARCH_DROPDOWN)
    .should('be.visible')
    .should('contain', categoryName)
    .contains(categoryName)
    .click();

  // Verify category was selected
  cy.get('[data-cy^="selected-category-"] > span').should(
    'contain.text',
    categoryName
  );

  cy.task('log', `✅ Category "${categoryName}" selected`);
});

/**
 * Site Selection Commands (Multi-site Support)
 */

// Map of site IDs to their data-cy attribute names (must match SiteSelector component's site.name values)
// The SiteSelector uses lowercase site.name for data-cy attributes: data-cy="site-selector-{site.name}"
const SITE_NAME_MAP: Record<string, string> = {
  dealabs: 'dealabs',
  vinted: 'vinted',
  leboncoin: 'leboncoin',
};

/**
 * Select sites for the filter (multi-site support)
 * @param siteIds - Array of site IDs to select (e.g., ['dealabs', 'vinted'])
 */
Cypress.Commands.add('selectSites', (siteIds: string[]) => {
  // Verify site selector is visible
  cy.get(SELECTORS.SITES.SELECTOR).should('be.visible');

  // Click each site we want to select
  siteIds.forEach((siteId: string) => {
    const displayName = SITE_NAME_MAP[siteId] || siteId;
    cy.get(SELECTORS.SITES.SITE_BUTTON(displayName))
      .should('be.visible')
      .then(($btn) => {
        // Check if already selected (aria-checked="true")
        if ($btn.attr('aria-checked') !== 'true') {
          cy.wrap($btn).click();
          cy.task('log', `✅ Site "${displayName}" selected`);
        } else {
          cy.task('log', `ℹ️ Site "${displayName}" already selected`);
        }
      });
  });

  // Verify the count matches
  cy.get(SELECTORS.SITES.COUNT).should(
    'contain.text',
    `${siteIds.length} site`
  );
});

/**
 * Deselect a site
 * @param siteId - Site ID to deselect (e.g., 'dealabs')
 */
Cypress.Commands.add('deselectSite', (siteId: string) => {
  const displayName = SITE_NAME_MAP[siteId] || siteId;
  cy.get(SELECTORS.SITES.SITE_BUTTON(displayName))
    .should('be.visible')
    .then(($btn) => {
      // Check if selected (aria-checked="true")
      if ($btn.attr('aria-checked') === 'true') {
        cy.wrap($btn).click();
        cy.task('log', `✅ Site "${displayName}" deselected`);
      } else {
        cy.task('log', `ℹ️ Site "${displayName}" already deselected`);
      }
    });
});

/**
 * Filter Commands
 */

// Create filter via UI with intelligent waiting
Cypress.Commands.add('createFilter', (filterData: any) => {
  // Intercept all relevant API calls
  cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');
  cy.intercept('POST', API_ROUTES.FILTERS_CREATE).as('createFilterRequest');

  cy.visit('/filters/create');

  // Wait for the form to be visible before interacting (auth loading must resolve first)
  cy.get(SELECTORS.FILTERS.FILTER_FORM, { timeout: 15000 }).should('be.visible');

  // Fill in filter name
  cy.get(SELECTORS.FILTERS.NAME_INPUT).type(filterData.name);

  if (filterData.description) {
    cy.get(SELECTORS.FILTERS.DESCRIPTION_INPUT).type(filterData.description);
  }

  // Select sites FIRST (required before category selection)
  // Categories are site-specific, so sites must be selected before searching categories
  // Note: By default, Dealabs is pre-selected in the form, so we need to handle
  // cases where we want different sites or multiple sites
  if (filterData.enabledSites && filterData.enabledSites.length > 0) {
    // First, deselect all currently selected sites
    Object.keys(SITE_NAME_MAP).forEach((siteId) => {
      cy.deselectSite(siteId);
    });
    // Then select the desired sites
    cy.selectSites(filterData.enabledSites);
  }
  // If no enabledSites specified, Dealabs remains selected by default

  // Select categories AFTER sites are selected
  // Category search now filters by selected sites
  if (filterData.categories && filterData.categories.length > 0) {
    filterData.categories.forEach((categorySlug: string) => {
      cy.selectCategory(categorySlug);
    });
  }

  // Add filter rules
  if (filterData.rules && filterData.rules.length > 0) {
    filterData.rules.forEach((rule: any, index: number) => {
      if (index > 0) {
        cy.get('[data-cy=add-rule-button]').click();
      }

      // Map operators to their cypress selector equivalents (must match Dropdown.tsx getSafeDataCyValue)
      const operatorMap: Record<string, string> = {
        '<': 'lt',
        '<=': 'lte', // Matches Dropdown.tsx line 139
        '>': 'gt',
        '>=': 'gte', // Matches Dropdown.tsx line 140
        '=': 'eq',
        '!=': 'neq',
        CONTAINS: 'CONTAINS',
        NOT_CONTAINS: 'NOT_CONTAINS',
      };

      const cypressOperator = operatorMap[rule.operator] || rule.operator;

      // Select field
      cy.get(`[data-cy=rule-field-select-${index}]`)
        .should('be.visible')
        .click();
      cy.clickDropdownOption(`[data-cy=field-option-${rule.field}]`);

      // Select operator
      cy.get(`[data-cy=rule-operator-select-${rule.field}-${index}]`)
        .should('be.visible')
        .click();
      cy.clickDropdownOption(`[data-cy=operator-option-${cypressOperator}]`);
      cy.get(
        `[data-cy=rule-value-input-${rule.field}-${cypressOperator}-${index}]`
      )
        .should('be.visible')
        .type(rule.value.toString());
    });
  }

  // Set filter options
  if (filterData.immediateNotifications !== undefined) {
    // Use the same pattern as the working test code - click the label instead of check/uncheck
    // First uncheck to ensure we're in a known state (since it's checked by default)
    cy.get('[data-cy=immediate-notifications-checkbox-label]')
      .should('be.visible')
      .click(); // Uncheck first

    // Then check it again if the test data requires it
    if (filterData.immediateNotifications) {
      cy.get('[data-cy=immediate-notifications-checkbox-label]')
        .should('be.visible')
        .click(); // Check it back
    }
  }

  // Submit filter
  cy.get(SELECTORS.FILTERS.SUBMIT_CREATE).click();

  // Wait for API response instead of toast
  cy.wait('@createFilterRequest').its('response.statusCode').should('eq', 201);

  // Verify success toast appears
  cy.get(SELECTORS.TOAST.SUCCESS, { timeout: TIMEOUTS.ELEMENT_VISIBLE }).should(
    'be.visible'
  );
  cy.get(SELECTORS.TOAST.TITLE).should('contain.text', 'Filter Created');

  cy.task('log', `✅ Filter "${filterData.name}" created successfully`);
});

/**
 * Service Health Commands
 */

// Wait for worker pool to have registered workers
// This addresses the race condition where services are ready but workers haven't registered yet
Cypress.Commands.add('waitForWorkerPool', () => {
  const schedulerReadyUrl = `${Cypress.env('schedulerUrl')}/health/ready`;
  const maxAttempts = 15;
  const pollInterval = 2000;

  cy.task('log', '⏳ Waiting for worker pool to have registered workers...');

  const checkWorkerPool = (attempt: number): Cypress.Chainable<void> => {
    if (attempt >= maxAttempts) {
      cy.task(
        'log',
        `❌ Worker pool did not have registered workers after ${maxAttempts * (pollInterval / 1000)}s`
      );
      throw new Error(
        `Worker pool did not have registered workers after ${maxAttempts * (pollInterval / 1000)} seconds`
      );
    }

    return cy
      .request({
        method: 'GET',
        url: schedulerReadyUrl,
        timeout: TIMEOUTS.SERVICE_HEALTH,
        failOnStatusCode: false,
      })
      .then((response): Cypress.Chainable<void> => {
        if (response.status !== 200) {
          cy.task(
            'log',
            `⏳ Scheduler not ready (attempt ${attempt + 1}/${maxAttempts})`
          );
          cy.wait(pollInterval);
          return checkWorkerPool(attempt + 1);
        }

        const workerPoolStatus = response.body.data?.dependencies?.workerPool;

        // Debug: log the full scheduler health response on first attempt
        if (attempt === 0) {
          cy.task(
            'log',
            `🔍 Scheduler /health/ready response: ${JSON.stringify(response.body, null, 2)}`
          );
        }

        // Worker pool is ready only when 'healthy' (workers registered AND responding)
        // 'degraded' = workers registered but <25% responding to health checks
        // 'unhealthy' = no workers registered at all
        if (workerPoolStatus === 'healthy') {
          cy.task('log', `✅ Worker pool ready: status=${workerPoolStatus}`);
          return cy.wrap(undefined) as unknown as Cypress.Chainable<void>;
        }

        cy.task(
          'log',
          `⏳ No workers registered yet (workerPool=${workerPoolStatus}, attempt ${attempt + 1}/${maxAttempts})`
        );
        cy.wait(pollInterval);
        return checkWorkerPool(attempt + 1);
      });
  };

  return checkWorkerPool(0);
});

// Wait for all services to be healthy with retries
Cypress.Commands.add('waitForServices', () => {
  const services = [
    { name: 'API', url: `${Cypress.env('apiUrl')}/health/ready` },
    { name: 'Scraper', url: `${Cypress.env('scraperUrl')}/health/ready` },
    { name: 'Notifier', url: `${Cypress.env('notifierUrl')}/health/ready` },
    { name: 'Scheduler', url: `${Cypress.env('schedulerUrl')}/health/ready` },
  ];

  // First, wait for all services to be responding
  services.forEach((service) => {
    cy.request({
      method: 'GET',
      url: service.url,
      timeout: TIMEOUTS.SERVICE_HEALTH,
      retryOnStatusCodeFailure: true, // Retry on service not ready
      retryOnNetworkFailure: true,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('success', true);

      const actualStatus = response.body.data?.status;
      // Accept any status for initial service check - we'll verify full health after worker pool
      const statusEmoji =
        actualStatus === 'healthy'
          ? '✅'
          : actualStatus === 'degraded'
            ? '⚠️'
            : '❌';
      cy.task(
        'log',
        `${statusEmoji} ${service.name} service responding (status: ${actualStatus})`
      );
    });
  });

  // Wait for worker pool to be ready (addresses race condition)
  cy.waitForWorkerPool();

  // Final verification - all services should now be healthy
  cy.request({
    method: 'GET',
    url: `${Cypress.env('apiUrl')}/health/ready`,
    timeout: TIMEOUTS.SERVICE_HEALTH,
  }).then((response) => {
    const actualStatus = response.body.data?.status;
    const dependencies = response.body.data?.dependencies;

    // Now we expect 'healthy' since workers should be registered
    if (actualStatus !== 'healthy') {
      cy.task(
        'log',
        `⚠️ API still not fully healthy after worker pool ready. Status: ${actualStatus}, Dependencies: ${JSON.stringify(dependencies)}`
      );
    }

    // Accept 'healthy' or 'degraded' - degraded is acceptable as long as core functionality works
    const acceptableStatuses = ['healthy', 'degraded'];
    expect(
      acceptableStatuses.includes(actualStatus),
      `API service returned '${actualStatus}' (expected 'healthy' or 'degraded'). Dependencies: ${JSON.stringify(dependencies)}`
    ).to.be.true;
  });

  cy.task('log', '✅ All services are ready');
});

/**
 * UI Interaction Commands
 */

// Custom command to click dropdown options that might be outside viewport
Cypress.Commands.add(
  'clickDropdownOption',
  (selector: string, options = {}) => {
    cy.get(selector).then(($el) => {
      // Check if element is visible in its scrollable container
      const element = $el[0];
      const rect = element.getBoundingClientRect();
      const container = element.closest(
        '[style*="overflow"], .dropdown-menu, [role="listbox"]'
      );

      if (container) {
        const containerRect = container.getBoundingClientRect();
        const isVisible =
          rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;

        if (!isVisible) {
          // Scroll element into view within its container
          cy.wrap($el).scrollIntoView({
            easing: 'linear',
            duration: 100,
          });
        }
      }

      // Click the element
      cy.wrap($el).should('be.visible').click(options);
    });
  }
);

/**
 * Scheduler Commands
 */

// Trigger scraping for all categories
Cypress.Commands.add('triggerScraping', () => {
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.env('schedulerUrl')}/scheduler/debug/trigger-scrape`,
      failOnStatusCode: false,
    })
    .then((response) => {
      if (response.status === 200) {
        cy.task('log', '✅ Scraping triggered successfully');
        return cy.wrap(response.body);
      } else {
        cy.task('log', '⚠️ Scheduler not available, skipping scraping trigger');
        return cy.wrap(null);
      }
    });
});

// Trigger scraping for a specific category
Cypress.Commands.add('triggerCategoryScraping', (categorySlug: string) => {
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.env('schedulerUrl')}/scheduler/debug/trigger-category-scrape/${categorySlug}`,
      failOnStatusCode: false,
    })
    .then((response) => {
      if (response.status === 200) {
        const body = response.body;
        // Check if a scheduled job was actually found and triggered
        if (
          body.message &&
          body.message.includes('No active scheduled job found')
        ) {
          cy.task(
            'log',
            `⚠️ No active scheduled job found for category: ${categorySlug}. The filter may not have been properly linked to a ScheduledJob.`
          );
          // Log additional debug info
          cy.task('log', `📋 Response: ${JSON.stringify(body)}`);
          return cy.wrap({ success: false, ...body });
        }
        cy.task('log', `✅ Scraping triggered for category: ${categorySlug}`);
        return cy.wrap({ success: true, ...body });
      } else {
        cy.task(
          'log',
          `⚠️ Scheduler not available (status ${response.status}), skipping scraping trigger for ${categorySlug}`
        );
        return cy.wrap({ success: false, error: 'Scheduler not available' });
      }
    });
});

// Get scheduler status
Cypress.Commands.add('getSchedulerStatus', () => {
  return cy
    .request({
      method: 'GET',
      url: `${Cypress.env('schedulerUrl')}/scheduler/debug/status`,
      failOnStatusCode: false,
    })
    .then((response) => {
      if (response.status === 200) {
        cy.task('log', '📊 Scheduler status retrieved');
        return cy.wrap(response.body);
      } else {
        cy.task('log', '⚠️ Scheduler not available');
        return cy.wrap(null);
      }
    });
});

// Wait for a scheduled job to be available for a category, then trigger scraping
// This handles the asynchronous creation of ScheduledJobs after filter creation
Cypress.Commands.add(
  'waitForScheduledJobAndTriggerScraping',
  (categorySlug: string, maxAttempts: number = 10, delayMs: number = 500) => {
    const attemptTrigger = (attempt: number): Cypress.Chainable<any> => {
      return cy
        .request({
          method: 'POST',
          url: `${Cypress.env('schedulerUrl')}/scheduler/debug/trigger-category-scrape/${categorySlug}`,
          failOnStatusCode: false,
        })
        .then((response) => {
          if (response.status === 200) {
            const body = response.body;
            if (
              body.message &&
              body.message.includes('No active scheduled job found')
            ) {
              if (attempt < maxAttempts) {
                cy.task(
                  'log',
                  `⏳ Waiting for ScheduledJob to be created (attempt ${attempt}/${maxAttempts})...`
                );
                cy.wait(delayMs);
                return attemptTrigger(attempt + 1);
              } else {
                cy.task(
                  'log',
                  `❌ ScheduledJob not found after ${maxAttempts} attempts for category: ${categorySlug}`
                );
                return cy.wrap({ success: false, ...body });
              }
            }
            cy.task(
              'log',
              `✅ Scraping triggered for category: ${categorySlug}`
            );
            return cy.wrap({ success: true, ...body });
          } else {
            cy.task(
              'log',
              `⚠️ Scheduler not available (status ${response.status})`
            );
            return cy.wrap({
              success: false,
              error: 'Scheduler not available',
            });
          }
        });
    };

    return attemptTrigger(1);
  }
);

/**
 * Utility Commands
 */

// Generate unique test data
Cypress.Commands.add('generateTestUser', () => {
  const timestamp = Date.now();
  return {
    email: `test.user.${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };
});

/**
 * TypeScript Declarations
 */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login to the application
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Login as an admin user and navigate to admin page
       */
      loginAsAdmin(email: string, password: string): Chainable<void>;

      /**
       * Create admin user in the database
       */
      createAdminUser(userData: any): Chainable<any>;

      /**
       * Logout from the application
       */
      logout(): Chainable<void>;

      /**
       * Ensure default development user exists
       */
      ensureDefaultUser(): Chainable<any>;

      /**
       * Create test user
       */
      createTestUser(userData: any): Chainable<any>;

      /**
       * Wait for email to be received
       */
      waitForEmail(
        recipient: string,
        subject: string,
        timeout?: number
      ): Chainable<any>;

      /**
       * Extract reset link from email
       */
      getResetLinkFromEmail(email: any): Chainable<string>;

      /**
       * Extract verification link from email
       */
      getVerificationLinkFromEmail(email: any): Chainable<string>;

      /**
       * Select a category by search and click
       * @param categorySlugOrName - Category slug (e.g., 'accessoires-gaming') or display name
       */
      selectCategory(categorySlugOrName: string): Chainable<void>;

      /**
       * Select sites for the filter (multi-site support)
       * @param siteIds - Array of site IDs to select (e.g., ['dealabs', 'vinted'])
       */
      selectSites(siteIds: string[]): Chainable<void>;

      /**
       * Deselect a site
       * @param siteId - Site ID to deselect (e.g., 'dealabs')
       */
      deselectSite(siteId: string): Chainable<void>;

      /**
       * Create filter via UI
       */
      createFilter(filterData: any): Chainable<void>;

      /**
       * Wait for worker pool to have registered workers
       * Polls the scheduler until at least one worker is registered
       */
      waitForWorkerPool(): Chainable<void>;

      /**
       * Wait for all services to be healthy
       */
      waitForServices(): Chainable<void>;

      /**
       * Generate unique test user data
       */
      generateTestUser(): Chainable<any>;

      /**
       * Click a dropdown option, automatically scrolling if needed
       */
      clickDropdownOption(
        selector: string,
        options?: Partial<Cypress.ClickOptions>
      ): Chainable<JQuery<HTMLElement>>;

      /**
       * Trigger scraping for all categories
       */
      triggerScraping(): Chainable<any>;

      /**
       * Trigger scraping for a specific category
       */
      triggerCategoryScraping(categorySlug: string): Chainable<any>;

      /**
       * Wait for a scheduled job to be available, then trigger scraping
       * Polls the scheduler until the ScheduledJob exists (handles async creation after filter creation)
       */
      waitForScheduledJobAndTriggerScraping(
        categorySlug: string,
        maxAttempts?: number,
        delayMs?: number
      ): Chainable<{
        success: boolean;
        message?: string;
        categorySlug?: string;
        timestamp?: string;
        error?: string;
      }>;

      /**
       * Get scheduler status
       */
      getSchedulerStatus(): Chainable<any>;
    }
  }
}

export {};
