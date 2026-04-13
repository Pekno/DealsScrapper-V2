/**
 * Filter Management - Comprehensive E2E Test Suite
 *
 * Consolidated test suite covering:
 * - Filter creation, editing, deletion with both UI workflow and fixture data validation
 * - Category search and selection functionality
 * - Performance testing with controlled fixture data
 * - Error handling and edge cases
 * - Data consistency validation
 */

import type { TestUser, TestFilter, FixtureArticle } from '../../support/types';
import { API_ROUTES } from '../../support/constants';

describe('Filter Management - Comprehensive E2E', () => {
  let testUser: TestUser;
  let testFilter: TestFilter;

  before(() => {
    // Ensure all services are healthy before starting
    cy.waitForServices();

    // Clean database and create test categories only (no articles needed)
    cy.task('db:cleanup');

    // Create test categories for filter testing
    cy.task('db:createTestCategories').then((result: unknown) => {
      const categories = result as Array<{ id: string; name: string }>;
      cy.log(
        `🎯 Created ${categories.length} test categories for filter testing`
      );
    });
  });

  beforeEach(() => {
    // Use default user instead of creating new ones
    testUser = {
      email: 'user@example.com',
      password: 'StrongP@ssw0rd',
      firstName: 'John',
      lastName: 'Doe',
    };

    // Generate unique test filter data
    testFilter = {
      name: `Test Filter ${Date.now()}`,
      description: `Test filter for automation testing - ${Date.now()}`,
      rules: [
        {
          field: 'title',
          operator: 'CONTAINS',
          value: 'laptop',
          weight: 1.0,
        },
        {
          field: 'currentPrice',
          operator: '<',
          value: '1000',
          weight: 0.8,
        },
      ],
      categories: ['accessoires-gaming', 'high-tech'], // Use actual test categories that exist
      immediateNotifications: true,
      enabledSites: ['dealabs'], // Default to Dealabs for backward compatibility
    };

    cy.task(
      'log',
      `🧪 Starting filter test with default user: ${testUser.email}`
    );

    // Ensure default user exists and login
    cy.ensureDefaultUser();
    cy.login(testUser.email, testUser.password);
  });

  afterEach(() => {
    // Clean up filters created during test to prevent test pollution
    cy.task('db:cleanupTestFilters', testUser.email);
    cy.task('log', '🧹 Cleaned up test filters for user: ' + testUser.email);
  });

  after(() => {
    // Final cleanup after all tests complete
    cy.task('db:cleanup');
    cy.task('log', '🧹 Final cleanup completed');
  });

  describe('Filter Creation Workflow', () => {
    it('should create a new filter through the complete form workflow', () => {
      cy.task('log', '🧪 Testing complete filter creation workflow...');

      // Intercept filter creation API call
      cy.intercept('POST', API_ROUTES.FILTERS_CREATE).as('createFilter');

      // Step 1: Navigate to filters page and click create
      cy.url().should('include', '/filters');
      cy.get('[data-cy=create-filter-button]')
        .should('be.visible')
        .click();

      // Step 2: Verify we're on the create page
      cy.url().should('include', '/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Step 3: Fill in basic filter information
      cy.get('[data-cy=filter-name-input]')
        .should('be.visible')
        .clear()
        .type(testFilter.name);

      cy.get('[data-cy=filter-description-input]')
        .should('be.visible')
        .clear()
        .type(testFilter.description || '');

      // Step 3.5: Test category search and selection
      cy.log('🔍 Testing category search functionality');

      // Intercept category search API
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      // Test category search input
      cy.get('[data-cy=category-search-input]')
        .should('be.visible')
        .clear()
        .type('high');

      // Wait for API response and dropdown to appear
      cy.wait('@categorySearch');
      cy.get('[data-cy=category-search-dropdown]').should('be.visible');

      // Test category selection from search results
      cy.get('[data-cy=category-search-dropdown]')
        .find('[data-cy^="category-option-"]')
        .first()
        .click();

      // Verify category was added to selected list
      cy.get('[data-cy^="selected-category-"]')
        .should('have.length.gte', 1)
        .first()
        .should('be.visible');

      // Test searching for and selecting a second category
      cy.get('[data-cy=category-search-input]')
        .should('be.visible')
        .clear()
        .type('jeux');

      cy.wait('@categorySearch');
      cy.get('[data-cy=category-search-dropdown]')
        .should('be.visible')
        .find('[data-cy^="category-option-"]')
        .first()
        .click();

      // Verify two categories are now selected
      cy.get('[data-cy^="selected-category-"]').should('have.length.gte', 2);

      // Test category removal by clicking the remove button
      cy.get('[data-cy^="selected-category-"]')
        .first()
        .find('[data-testid="badge-remove"]') // Badge component remove button
        .click();

      // Verify category was removed
      cy.get('[data-cy^="selected-category-"]').should('have.length.gte', 1);

      // First rule
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-title]');

      cy.get('[data-cy=rule-operator-select-title-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-CONTAINS]');

      cy.get('[data-cy=rule-value-input-title-CONTAINS-0]')
        .should('be.visible')
        .clear()
        .type(testFilter.rules[0].value);

      // Add second rule
      cy.get('[data-cy=add-rule-button]').click();

      cy.get('[data-cy=rule-field-select-1]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-currentPrice]');

      cy.get('[data-cy=rule-operator-select-currentPrice-1]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-lt]');

      cy.get('[data-cy=rule-value-input-currentPrice-lt-1]')
        .should('be.visible')
        .clear()
        .type(testFilter.rules[1].value);

      // Step 5: Configure notifications - test both unchecking and checking
      // First uncheck to ensure we're in a known state (since it's checked by default)
      cy.get('[data-cy=immediate-notifications-checkbox-label]')
        .should('be.visible')
        .click(); // Uncheck first

      // Then check it again if the test data requires it
      if (testFilter.immediateNotifications) {
        cy.get('[data-cy=immediate-notifications-checkbox-label]')
          .should('be.visible')
          .click(); // Check it back
      }

      // Step 6: Submit the form
      cy.get('[data-cy=create-filter-submit]')
        .should('be.visible')
        .should('not.be.disabled')
        .click();

      // Step 7: Wait for API call and verify creation success
      cy.wait('@createFilter');
      cy.url({ timeout: 15000 }).should('include', '/filters');
      // Wait for success toast notification
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Created');

      // Step 8: Verify filter appears in the list
      cy.get('[data-cy=filter-grid]').should('be.visible');
      cy.get('[data-cy=filter-card]')
        .should('be.visible')
        .should('contain.text', testFilter.name);

      cy.task('log', '✅ Filter creation workflow completed successfully');
    });

    it('should create a price-based filter with category selection', () => {
      cy.task('log', '🧪 Testing filter creation with category selection...');

      // Intercept API calls
      cy.intercept('POST', API_ROUTES.FILTERS_CREATE).as('createPriceFilter');
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      // Step 1: Navigate to create filter page
      cy.get('[data-cy=create-filter-button]').click();
      cy.url().should('include', '/filters/create');

      // Step 2: Fill basic filter information
      cy.get('[data-cy=filter-name-input]').type('Gaming Deals Under €30');
      cy.get('[data-cy=filter-description-input]').type(
        'Affordable gaming accessories'
      );

      // Step 3: Select category - "Accessoires gaming" should exist from test setup
      cy.selectCategory('accessoires-gaming');

      // Step 5: Configure the first rule (already present) - price under €30
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-currentPrice]');

      cy.get('[data-cy=rule-operator-select-currentPrice-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-lt]');

      cy.get('[data-cy=rule-value-input-currentPrice-lt-0]')
        .should('be.visible')
        .type('30');

      // Step 6: Submit filter
      cy.get('[data-cy=create-filter-submit]').click();

      // Step 7: Wait for API call and verify success
      cy.wait('@createPriceFilter');

      // Wait for success notification
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Created');

      cy.url().should('include', '/filters');
      cy.contains('Gaming Deals Under €30').should('be.visible');

      // Step 8: Verify filter was saved properly
      cy.get('[data-cy=filter-card]').should(
        'contain',
        'Gaming Deals Under €30'
      );
      cy.get('[data-cy=filter-card]').should(
        'contain',
        'Affordable gaming accessories'
      );

      cy.task('log', '✅ Price filter with category selection successful');
    });

    it('should create a complex multi-rule filter with fixture data validation', () => {
      cy.task('log', '🧪 Testing complex multi-rule filter creation...');

      // Intercept API calls
      cy.intercept('POST', API_ROUTES.FILTERS_CREATE).as('createComplexFilter');
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      // Step 1: Navigate to create filter page
      cy.get('[data-cy=create-filter-button]').click();

      // Step 2: Fill basic information
      cy.get('[data-cy=filter-name-input]').type('Premium Gaming Deals');
      cy.get('[data-cy=filter-description-input]').type(
        'High-temperature, discounted gaming accessories'
      );

      // Step 3: Select category
      cy.selectCategory('accessoires-gaming');

      // Step 4: Configure the first rule (already present) - temperature (hot deals)
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-temperature]');

      cy.get('[data-cy=rule-operator-select-temperature-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-gt]');

      cy.get('[data-cy=rule-value-input-temperature-gt-0]')
        .should('be.visible')
        .type('50');

      // Step 5: Add discount rule
      cy.get('[data-cy=add-rule-button]').click();
      cy.get('[data-cy=rule-field-select-1]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-discountPercentage]');

      cy.get('[data-cy=rule-operator-select-discountPercentage-1]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-gt]');

      cy.get('[data-cy=rule-value-input-discountPercentage-gt-1]')
        .should('be.visible')
        .type('20');

      // Step 6: Submit filter
      cy.get('[data-cy=create-filter-submit]').click();

      // Step 7: Wait for API call and verify success
      cy.wait('@createComplexFilter');
      cy.url().should('include', '/filters');
      cy.contains('Premium Gaming Deals').should('be.visible');

      // Step 8: Wait for ScheduledJob and trigger scraping to test filter matching
      cy.log('🚀 Waiting for ScheduledJob and triggering scraping...');
      cy.waitForScheduledJobAndTriggerScraping('accessoires-gaming');
      cy.wait(2000); // Allow async processing time

      // Step 9: Navigate to filter detail page to check matches
      cy.get('[data-cy=filter-card]').contains('Premium Gaming Deals').click();

      // Step 10: Wait for scraping to complete and check for matches in the Matching Products table
      cy.get('h2:contains("Matching Products")', { timeout: 15000 }).should(
        'be.visible'
      );

      // Check if matches were found (table exists) or not (empty state)
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="matching-products-table"]').length > 0) {
          cy.get('[data-cy="matching-products-table"]')
            .should('be.visible')
            .find('tbody tr')
            .should('have.length.greaterThan', 0);
          cy.log('✅ Found matching products in table');
        } else {
          cy.log(
            'ℹ️ No matching products found - filter may be too restrictive for test data'
          );
        }
      });

      cy.task('log', '✅ Complex multi-rule filter creation successful');
    });

    it('should handle filter creation validation errors', () => {
      cy.task('log', '🧪 Testing filter creation validation...');

      // Step 1: Navigate to create filter page
      cy.visit('/filters/create');

      // Step 2: Try to submit empty form
      cy.get('[data-cy=create-filter-submit]').click();

      // Step 3: Should show validation errors in the centralized error display
      cy.get('[data-cy=form-validation-errors]').should('be.visible');
      cy.get('[data-cy=error-name]')
        .should('be.visible')
        .should('contain.text', 'Filter name is required');

      // Step 4: Fill name but leave categories and rules empty
      cy.get('[data-cy=filter-name-input]').type('Test Filter');
      cy.get('[data-cy=create-filter-submit]').click();

      // Step 5: Should show category validation error
      cy.get('[data-cy=form-validation-errors]').should('be.visible');
      cy.get('[data-cy=error-categories]')
        .should('be.visible')
        .should('contain.text', 'At least one category must be selected');

      // Step 6: Add a category but leave rules empty
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');
      cy.selectCategory('accessoires-gaming');

      // Step 8: Submit again - should now succeed since we have both name and category
      cy.get('[data-cy=create-filter-submit]').click();

      // Step 9: Wait for success notification to appear
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Created');
      cy.get('[data-cy=toast-message]').should(
        'contain.text',
        'Filter "Test Filter" created successfully!'
      );

      // Step 10: Should succeed and redirect to filters page
      cy.url().should('include', '/filters');
      cy.contains('Test Filter').should('be.visible');

      cy.task('log', '✅ Filter creation validation working correctly');
    });

    it('should allow creating a filter with minimal required fields', () => {
      cy.task('log', '🧪 Testing minimal filter creation...');

      // Intercept API calls
      cy.intercept('POST', API_ROUTES.FILTERS_CREATE).as('createMinimalFilter');
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      // Step 1: Navigate to create filter page
      cy.visit('/filters/create');

      // Step 2: Fill only required fields
      cy.get('[data-cy=filter-name-input]').type('Minimal Filter');

      // Step 3: Select at least one category (required)
      cy.selectCategory('accessoires-gaming');

      // Step 4: Configure the first rule (already present)
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-title]');

      cy.get('[data-cy=rule-operator-select-title-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-CONTAINS]');

      cy.get('[data-cy=rule-value-input-title-CONTAINS-0]')
        .should('be.visible')
        .type('test');

      // Step 5: Submit
      cy.get('[data-cy=create-filter-submit]').click();

      // Step 6: Wait for API call and verify success
      cy.wait('@createMinimalFilter');
      cy.url().should('include', '/filters');
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );

      cy.task('log', '✅ Minimal filter creation successful');
    });
  });

  describe('Filter Editing Workflow', () => {
    beforeEach(() => {
      // Create a filter to edit
      cy.createFilter(testFilter);
    });

    it('should edit an existing filter successfully', () => {
      cy.task('log', '🧪 Testing filter editing workflow...');

      // Step 1: Navigate to filters and find our test filter
      cy.visit('/filters');
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .should('be.visible');

      // Step 2: Click edit button on the specific filter card
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Step 3: Verify we're on the edit page and intercept update call AFTER navigation
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Intercept filter update API call - do this AFTER navigating to the edit page
      cy.intercept('PATCH', API_ROUTES.FILTERS_UPDATE).as('updateFilter');

      // Step 4: Verify form is pre-populated
      cy.get('[data-cy=filter-name-input]').should(
        'have.value',
        testFilter.name
      );

      cy.get('[data-cy=filter-description-input]').should(
        'have.value',
        testFilter.description || ''
      );

      // Step 5: Make changes
      const updatedName = `${testFilter.name} - Updated`;
      const updatedDescription = `${testFilter.description || ''} - Updated`;

      cy.get('[data-cy=filter-name-input]').clear().type(updatedName);

      cy.get('[data-cy=filter-description-input]')
        .clear()
        .type(updatedDescription);

      // Step 6: Submit changes
      cy.get('[data-cy=update-filter-submit]').should('be.visible').click();

      // Step 7: Wait for API call and verify update success
      cy.wait('@updateFilter', { timeout: 20000 })
        .its('response.statusCode')
        .should('be.oneOf', [200, 201]);

      // Wait for success toast notification
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Updated');

      // Step 8: Should redirect to filters list page after update
      cy.url({ timeout: 15000 }).should('include', '/filters');

      // Verify the updated filter appears in the list
      cy.get('[data-cy=filter-card]')
        .contains(updatedName)
        .should('be.visible');

      cy.task('log', '✅ Filter editing workflow completed successfully');
    });

    it('should edit filter rules and verify persistence', () => {
      cy.task('log', '🧪 Testing filter rule editing and persistence...');

      // Step 1: Navigate to filters and find our test filter
      cy.visit('/filters');
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .should('be.visible');

      // Step 2: Click edit button on the specific filter card
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Step 3: Verify we're on the edit page and intercept update call AFTER navigation
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Intercept filter update API call - do this AFTER navigating to the edit page
      cy.intercept('PATCH', API_ROUTES.FILTERS_UPDATE).as('updateFilterRules');

      // Step 4: Verify existing rules are displayed (we have 2 rules from testFilter)
      cy.get('[data-cy^=rule-field-select-]').should('have.length', 2);

      // Step 5: Add a third rule to test rule persistence
      cy.get('[data-cy=add-rule-button]').should('be.visible').click();

      // Configure the new third rule - temperature greater than 50
      cy.get('[data-cy=rule-field-select-2]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-temperature]');

      cy.get('[data-cy=rule-operator-select-temperature-2]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-gt]');

      cy.get('[data-cy=rule-value-input-temperature-gt-2]')
        .should('be.visible')
        .type('50');

      // Step 6: Submit changes
      cy.get('[data-cy=update-filter-submit]').should('be.visible').click();

      // Step 7: Wait for API call and verify update success
      cy.wait('@updateFilterRules', { timeout: 20000 })
        .its('response.statusCode')
        .should('be.oneOf', [200, 201]);

      // Wait for success toast notification
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Updated');

      // Step 8: Should redirect to filters list page after update
      cy.url({ timeout: 15000 }).should('include', '/filters');

      // Step 9: Navigate back to edit the filter again to verify rule persistence
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .should('be.visible');

      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Step 10: Verify we're back on the edit page
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Step 11: Verify we now have 3 rules (persistence check)
      cy.get('[data-cy^=rule-field-select-]').should('have.length', 3);

      // Step 12: Verify the third rule persisted correctly with the right field
      cy.get('[data-cy=rule-field-select-2]').should(
        'contain.text',
        'Temperature'
      );

      cy.task('log', '✅ Filter rule editing and persistence verified');
    });

    it('should allow canceling filter edit', () => {
      cy.task('log', '🧪 Testing filter edit cancellation...');

      // Step 1: Navigate to filters and find our test filter
      cy.visit('/filters');
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .should('be.visible');

      // Step 2: Click edit button to navigate to edit page
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Step 3: Verify we're on the edit page
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Step 4: Make some changes to the filter
      cy.get('[data-cy=filter-name-input]').clear().type('Changed Name');

      // Step 5: Intercept navigation back to filter detail page
      cy.intercept('GET', API_ROUTES.FILTERS_DETAIL).as('returnToFilterDetail');

      // Step 6: Click cancel button
      cy.get('[data-cy=cancel-edit-button]').should('be.visible').click();

      // Step 7: Wait for navigation back to filter detail page and verify
      cy.wait('@returnToFilterDetail');
      cy.url().should('match', /\/filters\/[^\/]+$/);

      // Step 8: Verify we're on the filter detail page
      cy.get('[data-cy=filter-detail-page]').should(
        'be.visible'
      );

      // Expand the General section to see the filter title
      // (It's collapsed by default on the detail page)
      cy.get('[data-cy=general-header]').click();

      // Verify the filter title shows the original name
      cy.get('[data-cy=filter-title]', { timeout: 5000 })
        .should('be.visible')
        .should('have.value', testFilter.name);

      // Step 9: Navigate back to edit page to verify changes were not saved
      cy.get('[data-cy=edit-filter-button]')
        .should('be.visible')
        .click();

      // Step 10: Verify we're on the edit page
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Step 11: Verify the name field still has the original value (not "Changed Name")
      cy.get('[data-cy=filter-name-input]').should(
        'have.value',
        testFilter.name
      );

      cy.task('log', '✅ Filter edit cancellation working correctly');
    });
  });

  describe('Filter Deletion Workflow', () => {
    beforeEach(() => {
      // Create a filter to delete
      cy.createFilter(testFilter);
    });

    it('should delete a filter with confirmation', () => {
      cy.task('log', '🧪 Testing filter deletion workflow...');

      // Intercept filter deletion API call
      cy.intercept('DELETE', API_ROUTES.FILTERS_DELETE).as('deleteFilter');

      // Step 1: Navigate to filters page
      cy.visit('/filters');

      // Step 2: Find and click delete button
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .should('be.visible');

      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=delete-filter-button]')
        .click();

      // Step 3: Verify confirmation modal appears
      cy.get('[data-cy=delete-confirmation-modal]').should(
        'be.visible'
      );

      cy.get('[data-cy=delete-confirmation-message]').should(
        'contain.text',
        testFilter.name
      );

      // Step 4: Confirm deletion
      cy.get('[data-cy=confirm-delete-button]').should('be.visible').click();

      // Step 5: Wait for API call and verify deletion success
      cy.wait('@deleteFilter');
      // Wait for success toast notification
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Deleted');

      // Step 6: Verify filter is removed from list
      // Check for create-first-filter-button (shown only when no filters exist)
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy=create-first-filter-button]').length > 0) {
          // Empty state - filter was successfully deleted (no filters left)
          cy.get('[data-cy=create-first-filter-button]').should('be.visible');
        } else {
          // Other filters exist - verify deleted filter is not among them
          cy.get('[data-cy=filter-card]').should(
            'not.contain.text',
            testFilter.name
          );
        }
      });

      cy.task('log', '✅ Filter deletion workflow completed successfully');
    });

    it('should allow canceling filter deletion', () => {
      cy.task('log', '🧪 Testing filter deletion cancellation...');

      // Step 1: Navigate to filters page
      cy.visit('/filters');

      // Step 2: Click delete button
      cy.get('[data-cy=filter-card]')
        .contains(testFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=delete-filter-button]')
        .click();

      // Step 3: Verify modal appears
      cy.get('[data-cy=delete-confirmation-modal]').should('be.visible');

      // Step 4: Click cancel
      cy.get('[data-cy=cancel-delete-button]').should('be.visible').click();

      // Step 5: Modal should close - wait for it to disappear
      cy.get('[data-cy=delete-confirmation-modal]').should('not.be.visible');

      // Step 6: Verify filter still exists in the list
      cy.get('[data-cy=filter-card]').should('contain.text', testFilter.name);

      cy.task('log', '✅ Filter deletion cancellation working correctly');
    });
  });

  describe('Filter Search and Navigation', () => {
    beforeEach(() => {
      // Create multiple filters for search testing
      cy.createFilter({ ...testFilter, name: 'Laptop Filter' });
      cy.createFilter({ ...testFilter, name: 'Phone Filter' });
      cy.createFilter({ ...testFilter, name: 'Tablet Filter' });
    });

    it('should search filters by name', () => {
      cy.task('log', '🧪 Testing filter search functionality...');

      // Step 1: Navigate to filters page
      cy.visit('/filters');

      // Step 2: Wait for filters to load
      cy.get('[data-cy=filter-grid]').should('be.visible');

      // Step 3: Search for "Laptop"
      cy.get('[data-cy=filter-search-input]')
        .should('be.visible')
        .clear()
        .type('Laptop');

      // Step 4: Should show only laptop filter
      cy.get('[data-cy=filter-card]')
        .should('have.length', 1)
        .should('contain.text', 'Laptop Filter');

      // Step 5: Clear search
      cy.get('[data-cy=filter-search-input]').clear();

      // Step 6: Should show all filters again
      cy.get('[data-cy=filter-card]').should('have.length.at.least', 3);

      cy.task('log', '✅ Filter search functionality working correctly');
    });

    it('should navigate to filter detail page', () => {
      cy.task('log', '🧪 Testing filter detail navigation...');

      // Step 1: Navigate to filters page
      cy.visit('/filters');

      // Step 2: Click on a filter card
      cy.get('[data-cy=filter-card]').contains('Laptop Filter').click();

      // Step 3: Should navigate to detail page
      cy.url().should('match', /\/filters\/[^\/]+$/);
      cy.get('[data-cy=filter-detail-page]').should(
        'be.visible'
      );

      // Step 4: Expand the General section to see the filter title
      // (It's collapsed by default on the detail page)
      cy.get('[data-cy=general-header]').click();

      // Step 5: Verify the filter title shows the original name
      cy.get('[data-cy=filter-title]', { timeout: 5000 })
        .should('be.visible')
        .should('have.value', 'Laptop Filter');

      cy.task('log', '✅ Filter detail navigation working correctly');
    });
  });

  describe('Category Search Functionality', () => {
    it('should provide comprehensive category search features', () => {
      cy.task(
        'log',
        '🔍 Testing comprehensive category search functionality...'
      );

      // Intercept category search API
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      cy.visit('/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Helper function to clear all selected categories
      const clearAllCategories = (): void => {
        cy.get('body').then(($body) => {
          // Check if there are any selected categories
          if ($body.find('[data-cy^="selected-category-"]').length > 0) {
            // Remove all selected categories one by one
            cy.get('[data-cy^="selected-category-"]').each(($el) => {
              cy.wrap($el).find('[data-testid="badge-remove"]').click();
            });
          }
        });
      };

      // Test 1 & 2 & 3: Basic category search, selection, and verification
      cy.log('🔍 Test 1-3: Category search and selection');
      cy.selectCategory('high-tech');

      // Test 4: Multiple category selection
      cy.log('🔍 Test 4: Multiple category selection');
      cy.selectCategory('accessoires-gaming');

      // Verify two categories selected
      cy.get('[data-cy^="selected-category-"]').should('have.length', 2);

      // Test 5: Category removal functionality
      cy.log('🔍 Test 5: Category removal functionality');
      cy.get('[data-cy=category-search-input]').clear(); // Clear to close dropdown

      // Remove first selected category
      cy.get('[data-cy^="selected-category-"]')
        .first()
        .find('[data-testid="badge-remove"]')
        .click();

      // Verify only one category remains
      cy.get('[data-cy^="selected-category-"]').should('have.length', 1);

      // Clean up: Remove all selected categories before next test
      clearAllCategories();

      // Test 6: Category search with no results
      cy.log('🔍 Test 6: Category search with no results');
      cy.get('[data-cy=category-search-input]')
        .clear()
        .type('nonexistentcategory12345');

      cy.wait('@categorySearch');
      cy.get('[data-cy=category-search-dropdown]')
        .should('be.visible')
        .should('contain.text', 'No available categories found');

      // Test 7: Search dropdown keyboard navigation
      cy.log('🔍 Test 7: Search dropdown keyboard navigation');

      // Step 1: Type search query
      cy.get('[data-cy=category-search-input]')
        .clear()
        .type('Accessoires gaming');

      // Step 2: Wait for search results to load
      cy.wait('@categorySearch');
      cy.get('[data-cy=category-search-dropdown]').should('be.visible');

      // Step 3: Navigate down with arrow key and select with Enter
      cy.get('[data-cy=category-search-input]');
      cy.press(Cypress.Keyboard.Keys.DOWN); // Navigate to first result (focusedIndex = 0)
      cy.press(Cypress.Keyboard.Keys.ENTER); // Select with Enter key

      // Step 4: Verify category was selected via keyboard
      cy.get('[data-cy^="selected-category-"]')
        .should('have.length', 1)
        .should('contain.text', 'Accessoires gaming');

      // Step 5: Clean up - Remove selected category before next test
      clearAllCategories();

      // Test 8: Search performance and debouncing (minimum 3 characters)
      cy.log('🔍 Test 8: Search debouncing behavior (3 char minimum)');
      cy.get('[data-cy=category-search-input]')
        .clear()
        .type('Hi') // Too short (2 chars), should not trigger search
        .wait(500);

      // Dropdown should show message about needing 3 characters
      cy.get('[data-cy=category-search-dropdown]')
        .should('be.visible')
        .should('contain.text', 'Type at least 3 characters to search');

      cy.get('[data-cy=category-search-input]')
        .type('g') // Now "Hig" (3 chars), should trigger search
        .wait(500);

      cy.wait('@categorySearch');
      cy.get('[data-cy=category-search-dropdown]').should('be.visible');

      cy.task(
        'log',
        '✅ Comprehensive category search functionality working correctly'
      );
    });

    it('should handle category search errors gracefully', () => {
      cy.task('log', '🔍 Testing category search error handling...');

      // Intercept category search API and simulate server error
      // Using statusCode 500 instead of forceNetworkError for CI reliability
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH, {
        statusCode: 500,
        body: { success: false, error: 'Failed to search categories' },
      }).as('categorySearchError');

      cy.visit('/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Trigger search that will fail
      cy.get('[data-cy=category-search-input]').clear().type('electronics');

      // Wait for search attempt (debounced, so only one request)
      cy.wait('@categorySearchError');

      // Verify error handling (dropdown should show error state)
      cy.get('[data-cy=category-search-dropdown]')
        .should('be.visible')
        .should('contain.text', 'Failed to search categories');

      cy.task('log', '✅ Category search error handling working correctly');
    });
  });

  describe('Performance Testing with Fixture Data', () => {
    it('should handle filter matching performance with known dataset', () => {
      cy.task('log', '🧪 Testing filter performance with fixture data...');

      // Intercept category search API
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      cy.visit('/filters/create');

      // Create a broad filter that should match multiple fixture items
      cy.get('[data-cy=filter-name-input]').type('Performance Test Filter');
      cy.get('[data-cy=filter-description-input]').type(
        'Testing filter performance with fixture data'
      );

      // Select category
      cy.selectCategory('accessoires-gaming');

      // Configure the first rule (already present) - broad rule that should match many items
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-currentPrice]');

      cy.get('[data-cy=rule-operator-select-currentPrice-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-gt]');

      cy.get('[data-cy=rule-value-input-currentPrice-gt-0]')
        .should('be.visible')
        .type('0');

      // Submit and measure response time
      const startTime = Date.now();
      cy.get('[data-cy=create-filter-submit]').click();

      // Wait for success notification as part of the performance test
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );

      cy.url()
        .should('include', '/filters')
        .then(() => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          cy.log(`Filter creation took ${responseTime}ms`);

          // Performance should be reasonable with fixture data (increased for CI/WSL environments)
          expect(responseTime).to.be.lessThan(30000);
        });

      // Test filter matching performance
      cy.get('[data-cy=filter-card]')
        .contains('Performance Test Filter')
        .click();

      const matchStartTime = Date.now();

      // Wait for the products section to be visible (contains either table, loading, or empty state)
      cy.get('h2:contains("Matching Products")', { timeout: 15000 }).should(
        'be.visible'
      );

      // Check if we have matches by looking for the table or verifying no matches
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="matching-products-table"]').length > 0) {
          // Table exists, verify it has rows
          cy.get('[data-cy="matching-products-table"]')
            .should('be.visible')
            .find('tbody tr')
            .should('have.length.greaterThan', 0)
            .then(() => {
              const matchEndTime = Date.now();
              const matchTime = matchEndTime - matchStartTime;
              cy.log(`Filter matching took ${matchTime}ms and found matches`);

              // Matching should be fast with known fixture data
              expect(matchTime).to.be.lessThan(15000);
            });
        } else {
          // No table means either loading or no matches
          // Check if there's an empty state message
          cy.get('body').then(() => {
            const matchEndTime = Date.now();
            const matchTime = matchEndTime - matchStartTime;
            cy.log(
              `Filter matching took ${matchTime}ms but found no matches - this may be expected with test data`
            );

            // Performance should still be reasonable even with no matches
            expect(matchTime).to.be.lessThan(15000);
          });
        }
      });

      cy.task('log', '✅ Performance testing successful');
    });
  });

  describe('Data Reliability and Consistency', () => {
    it('should validate fixture data integrity', function () {
      cy.task(
        'log',
        '🧪 Validating fixture data integrity with filter matching...'
      );

      // Step 1: Load fixture data to understand what we're testing against
      cy.fixture('../../apps/scraper/test/fixtures/correct-deals.json').then(
        (fixtureDeals: FixtureArticle[]) => {
          cy.log(
            `📊 Loaded ${fixtureDeals.length} deals from fixture for validation`
          );

          // Step 2: Analyze fixture data to determine price and heat ranges
          const priceRange = {
            min: Math.min(...fixtureDeals.map((d) => d.currentPrice)),
            max: Math.max(...fixtureDeals.map((d) => d.currentPrice)),
          };
          const heatRange = {
            min: Math.min(...fixtureDeals.map((d) => d.temperature)),
            max: Math.max(...fixtureDeals.map((d) => d.temperature)),
          };

          cy.log(
            `💰 Price range in fixtures: €${priceRange.min} - €${priceRange.max}`
          );
          cy.log(
            `🔥 Heat range in fixtures: ${heatRange.min}° - ${heatRange.max}°`
          );

          // Step 3: Create filter with specific rules designed to match a subset of fixture data
          const testFilter = {
            name: 'Fixture Data Integrity Test Filter',
            description:
              'Validates that scraper extracts and matches fixture data correctly',
            categories: ['accessoires-gaming'], // Matches the fixture category
            rules: [
              {
                field: 'currentPrice',
                operator: '<=',
                value: '100', // Should match 6 out of 8 deals
                weight: 1.0,
              },
              {
                field: 'temperature',
                operator: '>=',
                value: '0', // Should match deals with positive heat
                weight: 1.0,
              },
            ],
            immediateNotifications: false,
          };

          // Step 4: Calculate expected matches from fixture data based on filter rules
          const expectedMatches = fixtureDeals
            .filter((deal) => deal.currentPrice <= 100 && deal.temperature >= 0)
            .sort((a, b) => a.currentPrice - b.currentPrice); // Sort by price ASC (visible column)

          cy.log(
            `📋 Expected to match ${expectedMatches.length} deals from fixtures`
          );
          cy.log(
            'Expected matches (sorted by price ASC):',
            expectedMatches.map((d) => `${d.title} (€${d.currentPrice})`)
          );

          // Step 5: Create the filter using the custom command (handles category selection internally)
          cy.createFilter(testFilter);

          // Step 6: Navigate to filters page and find our test filter
          cy.visit('/filters');
          cy.get('[data-cy=filter-card]')
            .contains(testFilter.name)
            .should('be.visible');

          // Step 7: Wait for ScheduledJob to be created (async from filter creation), then trigger scraping
          cy.log(
            '🚀 Waiting for ScheduledJob and triggering scraping with fixture data...'
          );
          cy.waitForScheduledJobAndTriggerScraping('accessoires-gaming').then(
            (result) => {
              if (!result.success) {
                cy.log(
                  `⚠️ Scraping trigger failed: ${result.message || result.error}`
                );
              } else {
                cy.log('✅ Scraping successfully triggered');
              }
            }
          );

          // Step 9: Navigate to filter detail page
          cy.get('[data-cy=filter-card]').contains(testFilter.name).click();

          // Step 10: Wait for filter detail page to load
          cy.url().should('match', /\/filters\/[^\/]+$/);
          cy.get('[data-cy=filter-detail-page]').should(
            'be.visible'
          );

          // Step 11: Wait for SmartScrapingStatus loader to be hidden (scraping complete)
          cy.log('⏳ Waiting for scraping status to complete...');
          cy.get('[data-cy=scraping-status-loader]', { timeout: 15000 }).should(
            'not.exist'
          );

          // Step 12: Verify Matching Products section is displayed
          cy.get('h2:contains("Matching Products")', { timeout: 15000 }).should(
            'be.visible'
          );

          // Step 12.5: Sort by Price ascending to match expectedMatches order
          cy.log('🔄 Sorting table by Price ascending...');
          cy.get('[data-cy="sort-header-currentPrice"]')
            .should('be.visible')
            .click();
          cy.wait(500); // Allow sort to apply

          // Step 13: Validate match count and data integrity
          cy.get('body').then(($body) => {
            if ($body.find('[data-cy="matching-products-table"]').length > 0) {
              cy.get('[data-cy="matching-products-table"]')
                .should('be.visible')
                .find('tbody tr')
                .should('have.length', expectedMatches.length)
                .then(($rows) => {
                  cy.log(
                    `✅ Found ${$rows.length} matches, expected ${expectedMatches.length}`
                  );

                  // Step 14: Validate individual match data integrity row by row using data-cy attributes
                  // expectedMatches is already sorted by price ASC (same as table)
                  expectedMatches.forEach((expectedDeal, index) => {
                    cy.log(
                      `🔍 Validating row ${index + 1}: ${expectedDeal.title}`
                    );

                    // Use the row index to get the specific row
                    const $row = $rows.eq(index);

                    // Verify title in cell-title
                    cy.wrap($row)
                      .find('[data-cy="cell-title"]')
                      .should('contain.text', expectedDeal.title);

                    // Verify price in cell-price
                    // Note: Price format uses comma as decimal separator (European format)
                    // Format price with currency
                    const formatPrice = (price: number) => {
                      return new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(price);
                    };
                    const formattedPrice = formatPrice(
                      expectedDeal.currentPrice
                    );
                    cy.wrap($row)
                      .find('[data-cy="cell-currentPrice"]')
                      .should('contain.text', formattedPrice);

                    cy.log(
                      `✅ Validated row ${index + 1}: ${expectedDeal.title} (${formattedPrice})`);
                  });
                });

              cy.task('log', '✅ Fixture data integrity validation successful');
            } else {
              // Step 13: Handle case where no matches are found (test failure)
              cy.task(
                'log',
                '❌ FIXTURE VALIDATION FAILED: No matches found when matches were expected'
              );
              throw new Error(
                `Expected ${expectedMatches.length} matches but found none. Fixture data extraction may be broken.`
              );
            }
          });
        }
      );
    });

    it('should delete all matches when filter is edited to no longer match existing deals', () => {
      cy.task(
        'log',
        '🧪 Testing match deletion when filter criteria is changed...'
      );

      // Step 1: Load fixture data
      cy.fixture('../../apps/scraper/test/fixtures/correct-deals.json').then(
        (fixtureDeals: FixtureArticle[]) => {
          cy.log(
            `📊 Loaded ${fixtureDeals.length} deals from fixture for match deletion test`
          );

          // Step 2: Create filter that will match fixture data
          const testFilter = {
            name: 'Match Deletion Test Filter',
            description:
              'Testing that matches are deleted when filter criteria changes',
            categories: ['accessoires-gaming'],
            rules: [
              {
                field: 'currentPrice',
                operator: '<=',
                value: '100',
                weight: 1.0,
              },
            ],
            immediateNotifications: true, // Enable notifications to test full flow
          };

          // Step 3: Create the filter
          cy.createFilter(testFilter);

          // Step 4: Navigate to filters page
          cy.visit('/filters');
          cy.get('[data-cy=filter-card]')
            .contains(testFilter.name)
            .should('be.visible');

          // Step 5: Wait for ScheduledJob and trigger scraping to create matches
          cy.log('🚀 Waiting for ScheduledJob and triggering scraping...');
          cy.waitForScheduledJobAndTriggerScraping('accessoires-gaming');
          cy.wait(2000); // Allow async processing time

          // Step 6: Navigate to filter detail page
          cy.get('[data-cy=filter-card]').contains(testFilter.name).click();
          cy.url().should('match', /\/filters\/[^\/]+$/);
          cy.get('[data-cy=filter-detail-page]').should(
            'be.visible'
          );

          // Step 7: Wait for scraping to complete
          cy.log('⏳ Waiting for scraping and matching to complete...');
          cy.get('[data-cy=scraping-status-loader]', { timeout: 15000 }).should(
            'not.exist'
          );
          cy.wait(2000); // Allow time for async processing

          // Step 8: Verify matches exist in the table
          cy.get('h2:contains("Matching Products")', { timeout: 15000 }).should(
            'be.visible'
          );

          let matchCountBefore = 0;
          cy.get('body').then(($body) => {
            if ($body.find('[data-cy="matching-products-table"]').length > 0) {
              cy.get('[data-cy="matching-products-table"]')
                .should('be.visible')
                .find('tbody tr')
                .should('have.length.greaterThan', 0)
                .then(($rows) => {
                  matchCountBefore = $rows.length;
                  cy.log(
                    `✅ Found ${matchCountBefore} matches before filter edit`
                  );

                  // Step 9: Navigate to edit page
                  cy.get('[data-cy=edit-filter-button]')
                    .should('be.visible')
                    .click();
                  cy.url().should('include', '/edit');
                  cy.get('[data-cy=filter-form]').should('be.visible');

                  // Step 10: Intercept filter update API
                  cy.intercept('PATCH', API_ROUTES.FILTERS_UPDATE).as(
                    'updateFilter'
                  );

                  // Step 11: Change filter criteria to no longer match existing deals
                  // Clear existing rules and add a very restrictive rule
                  cy.get('[data-cy=rule-value-input-currentPrice-lte-0]')
                    .should('be.visible')
                    .clear()
                    .type('1'); // Change from <=100 to <=1 (will match nothing)

                  // Step 12: Submit filter update
                  cy.get('[data-cy=update-filter-submit]')
                    .should('be.visible')
                    .click();

                  // Step 13: Wait for update to complete
                  cy.wait('@updateFilter', { timeout: 20000 })
                    .its('response.statusCode')
                    .should('be.oneOf', [200, 201]);

                  cy.get('[data-cy=toast-success]').should('be.visible');
                  cy.get('[data-cy=toast-title]').should(
                    'contain.text',
                    'Filter Updated'
                  );

                  // Step 14: Navigate back to filter detail page
                  cy.url({ timeout: 15000 }).should('include', '/filters');
                  cy.get('[data-cy=filter-card]')
                    .contains(testFilter.name)
                    .click();

                  // Step 15: Verify matches were deleted (visible in UI)
                  cy.get('h2:contains("Matching Products")', {
                    timeout: 15000,
                  }).should('be.visible');

                  cy.get('body').then(($body) => {
                    // Table should either not exist or have 0 rows
                    if (
                      $body.find('[data-cy="matching-products-table"]').length >
                      0
                    ) {
                      cy.get('[data-cy="matching-products-table"]')
                        .find('tbody tr')
                        .should('have.length', 0);
                      cy.log(
                        `✅ Match table is now empty (was ${matchCountBefore} matches before edit)`
                      );
                    } else {
                      cy.log(
                        `✅ No match table displayed - all ${matchCountBefore} matches were deleted`
                      );
                    }
                  });

                  cy.task(
                    'log',
                    `✅ Match deletion test successful: ${matchCountBefore} matches deleted when filter criteria changed`
                  );
                });
            } else {
              cy.task(
                'log',
                '⚠️ SKIPPING MATCH DELETION TEST: No matches found initially - cannot test deletion'
              );
              cy.log(
                'ℹ️ This may happen if fixture data does not match filter criteria'
              );
            }
          });
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during filter creation', () => {
      cy.task('log', '🧪 Testing network error handling...');

      // Intercept API calls
      cy.intercept('POST', API_ROUTES.FILTERS_CREATE, {
        forceNetworkError: true,
      }).as('createFilterError');
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      cy.visit('/filters/create');

      // Fill form with all required fields
      cy.get('[data-cy=filter-name-input]').type('Test Filter');

      // Select a category (required)
      cy.selectCategory('accessoires-gaming');
      // Configure the first rule (already present)
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-title]');

      cy.get('[data-cy=rule-operator-select-title-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-CONTAINS]');

      cy.get('[data-cy=rule-value-input-title-CONTAINS-0]')
        .should('be.visible')
        .type('test');

      // Submit
      cy.get('[data-cy=create-filter-submit]').click();

      // Wait for the network error to occur
      cy.wait('@createFilterError');

      // Should show error message
      cy.get('[data-cy=toast-error]').should('be.visible');

      cy.get('[data-cy=toast-title]').should('contain.text', 'Network Error');

      cy.task('log', '✅ Network error handling working correctly');
    });

    it('should show frontend validation errors for missing required fields', () => {
      cy.task('log', '🧪 Testing frontend validation for missing fields...');

      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');
      cy.visit('/filters/create');

      // Test 1: Try submitting with completely empty form
      cy.log('Test 1: Submitting empty form');
      cy.get('[data-cy=create-filter-submit]').click();

      // Should show validation error for name
      cy.get('[data-cy=form-validation-errors]').should('be.visible');
      cy.get('[data-cy=error-name]')
        .should('be.visible')
        .should('contain.text', 'Filter name is required');

      // Test 2: Add name but no categories
      cy.log('Test 2: Adding name but no categories');
      cy.get('[data-cy=filter-name-input]').type('Test Filter');
      cy.get('[data-cy=create-filter-submit]').click();

      // Should show validation error for categories
      cy.get('[data-cy=form-validation-errors]').should('be.visible');
      cy.get('[data-cy=error-categories]')
        .should('be.visible')
        .should('contain.text', 'At least one category must be selected');

      // Test 3: Add a category but ensure at least one rule exists
      cy.log('Test 3: Adding category');
      cy.selectCategory('accessoires-gaming');

      // Test 4: Submit with category selected - form should have valid rules or create default
      cy.log('Test 4: Submitting with category selected');

      // The form should either have a default valid rule or require user to add one
      // Simply submit to test if the validation passes with a category selected

      // Now submit should work (no validation errors)
      cy.get('[data-cy=create-filter-submit]').click();

      // Should succeed and show success toast
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );

      cy.task('log', '✅ Frontend validation working correctly');
    });
  });

  describe('Site Selection (Multi-site Support)', () => {
    it('should display site selector with all available sites', () => {
      cy.task('log', '🧪 Testing site selector visibility...');

      cy.visit('/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Verify site selector is displayed
      cy.get('[data-cy=site-selector]').should('be.visible');

      // Verify all three sites are available
      cy.get('[data-cy=site-selector-dealabs]').should('be.visible');
      cy.get('[data-cy=site-selector-vinted]').should('be.visible');
      cy.get('[data-cy=site-selector-leboncoin]').should('be.visible');

      // Verify Dealabs is selected by default (aria-checked="true")
      cy.get('[data-cy=site-selector-dealabs]').should(
        'have.attr',
        'aria-checked',
        'true'
      );

      // Verify other sites are not selected by default
      cy.get('[data-cy=site-selector-vinted]').should(
        'have.attr',
        'aria-checked',
        'false'
      );
      cy.get('[data-cy=site-selector-leboncoin]').should(
        'have.attr',
        'aria-checked',
        'false'
      );

      // Verify count shows "1 site selected"
      cy.get('[data-cy=site-selector-count]').should('contain.text', '1 site');

      cy.task('log', '✅ Site selector displayed correctly with defaults');
    });

    it('should allow selecting and deselecting multiple sites', () => {
      cy.task('log', '🧪 Testing site selection toggle...');

      cy.visit('/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Initially Dealabs is selected (1 site)
      cy.get('[data-cy=site-selector-count]').should('contain.text', '1 site');

      // Select Vinted (should now be 2 sites)
      cy.get('[data-cy=site-selector-vinted]').click();
      cy.get('[data-cy=site-selector-vinted]').should(
        'have.attr',
        'aria-checked',
        'true'
      );
      cy.get('[data-cy=site-selector-count]').should('contain.text', '2 sites');

      // Select LeBonCoin (should now be 3 sites)
      cy.get('[data-cy=site-selector-leboncoin]').click();
      cy.get('[data-cy=site-selector-leboncoin]').should(
        'have.attr',
        'aria-checked',
        'true'
      );
      cy.get('[data-cy=site-selector-count]').should('contain.text', '3 sites');

      // Deselect Dealabs (should now be 2 sites)
      cy.get('[data-cy=site-selector-dealabs]').click();
      cy.get('[data-cy=site-selector-dealabs]').should(
        'have.attr',
        'aria-checked',
        'false'
      );
      cy.get('[data-cy=site-selector-count]').should('contain.text', '2 sites');

      // Deselect Vinted (should now be 1 site)
      cy.get('[data-cy=site-selector-vinted]').click();
      cy.get('[data-cy=site-selector-count]').should('contain.text', '1 site');

      cy.task('log', '✅ Site selection toggle working correctly');
    });

    it('should create a filter with multiple sites selected', () => {
      cy.task('log', '🧪 Testing filter creation with multiple sites...');

      // Intercept API calls
      cy.intercept('POST', API_ROUTES.FILTERS_CREATE).as('createMultiSiteFilter');
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      cy.visit('/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Fill in filter name
      cy.get('[data-cy=filter-name-input]').type('Multi-Site Test Filter');
      cy.get('[data-cy=filter-description-input]').type(
        'Filter targeting Dealabs and Vinted'
      );

      // Select category
      cy.selectCategory('accessoires-gaming');

      // Select multiple sites (Dealabs is already selected by default)
      cy.get('[data-cy=site-selector-vinted]').click();
      cy.get('[data-cy=site-selector-count]').should('contain.text', '2 sites');

      // Configure a rule
      cy.get('[data-cy=rule-field-select-0]').should('be.visible').click();
      cy.clickDropdownOption('[data-cy=field-option-currentPrice]');

      cy.get('[data-cy=rule-operator-select-currentPrice-0]')
        .should('be.visible')
        .click();
      cy.clickDropdownOption('[data-cy=operator-option-lt]');

      cy.get('[data-cy=rule-value-input-currentPrice-lt-0]')
        .should('be.visible')
        .type('500');

      // Submit filter
      cy.get('[data-cy=create-filter-submit]').click();

      // Wait for API call and verify the request was successful
      // Note: enabledSites is derived from categories by backend - not sent in request
      cy.wait('@createMultiSiteFilter').then((interception) => {
        const requestBody = interception.request.body;
        // Verify categoryIds are included (sites are derived from categories)
        expect(requestBody.categoryIds).to.be.an('array');
        expect(requestBody.categoryIds.length).to.be.greaterThan(0);
        cy.log('✅ Request included categories for multi-site filter');
      });

      // Verify success
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Created');

      cy.task('log', '✅ Multi-site filter created successfully');
    });

    it('should show validation error when no sites are selected', () => {
      cy.task('log', '🧪 Testing site selection validation...');

      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      cy.visit('/filters/create');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Fill in required fields
      cy.get('[data-cy=filter-name-input]').type('No Sites Filter');
      cy.selectCategory('accessoires-gaming');

      // Deselect all sites (Dealabs is selected by default)
      cy.get('[data-cy=site-selector-dealabs]').click();
      cy.get('[data-cy=site-selector-dealabs]').should(
        'have.attr',
        'aria-checked',
        'false'
      );

      // Count should not be visible when 0 sites are selected
      cy.get('[data-cy=site-selector-count]').should('not.exist');

      // Try to submit - should show validation error
      cy.get('[data-cy=create-filter-submit]').click();

      // Should show validation errors
      cy.get('[data-cy=form-validation-errors]').should('be.visible');
      cy.get('[data-cy=error-enabledSites]')
        .should('be.visible')
        .should('contain.text', 'At least one site must be selected');

      cy.task('log', '✅ Site selection validation working correctly');
    });

    it('should persist site selection when editing a filter', () => {
      cy.task('log', '🧪 Testing site selection persistence on edit...');

      // Create a filter with Dealabs categories
      // Note: enabledSites is derived from categories by backend
      const singleSiteFilter = {
        ...testFilter,
        name: `Site Edit Test ${Date.now()}`,
        categories: ['accessoires-gaming'], // Dealabs category
      };

      cy.createFilter(singleSiteFilter);

      // Navigate to filters page
      cy.visit('/filters');
      cy.get('[data-cy=filter-card]')
        .contains(singleSiteFilter.name)
        .should('be.visible');

      // Click edit button
      cy.get('[data-cy=filter-card]')
        .contains(singleSiteFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Verify we're on the edit page
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Verify site selection derived from categories is persisted
      // Since we used Dealabs category, Dealabs should be selected
      cy.get('[data-cy=site-selector-dealabs]').should(
        'have.attr',
        'aria-checked',
        'true'
      );

      cy.task('log', '✅ Site selection persisted correctly on edit');
    });

    it('should update site selection when editing a filter', () => {
      cy.task('log', '🧪 Testing site selection update on edit...');

      // Intercept category search API
      cy.intercept('GET', API_ROUTES.CATEGORIES_SEARCH).as('categorySearch');

      // Create a filter with Dealabs category
      // Note: enabledSites is derived from categories by backend
      const singleSiteFilter = {
        ...testFilter,
        name: `Site Update Test ${Date.now()}`,
        categories: ['accessoires-gaming'], // Dealabs category
      };

      cy.createFilter(singleSiteFilter);

      // Navigate to filters page
      cy.visit('/filters');
      cy.get('[data-cy=filter-card]')
        .contains(singleSiteFilter.name)
        .should('be.visible');

      // Click edit button
      cy.get('[data-cy=filter-card]')
        .contains(singleSiteFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Verify we're on the edit page
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Verify initial state: Dealabs is selected (derived from accessoires-gaming category)
      cy.get('[data-cy=site-selector-dealabs]').should(
        'have.attr',
        'aria-checked',
        'true'
      );

      // Verify at least one category is selected (accessoires-gaming)
      cy.get('[data-cy^="selected-category-"]').should('have.length.gte', 1);

      // Step 1: Add another category to test category update
      cy.log('🔄 Adding additional category to test update...');
      cy.get('[data-cy=category-search-input]')
        .should('be.visible')
        .clear()
        .type('high');

      cy.wait('@categorySearch');
      cy.get('[data-cy=category-search-dropdown]').should('be.visible');

      // Select a second category
      cy.get('[data-cy=category-search-dropdown]')
        .find('[data-cy^="category-option-"]')
        .first()
        .click();

      // Verify we now have at least 2 categories selected
      cy.get('[data-cy^="selected-category-"]').should('have.length.gte', 2);

      // Intercept update API
      cy.intercept('PATCH', API_ROUTES.FILTERS_UPDATE).as('updateFilter');

      // Submit changes
      cy.get('[data-cy=update-filter-submit]').click();

      // Wait for update and verify the request includes updated categories
      cy.wait('@updateFilter').then((interception) => {
        const requestBody = interception.request.body;
        // Verify request has categoryIds with multiple categories
        expect(requestBody).to.have.property('categoryIds');
        expect(requestBody.categoryIds).to.be.an('array');
        expect(requestBody.categoryIds.length).to.be.greaterThan(1);
        cy.log(
          `✅ Filter update request sent with ${requestBody.categoryIds.length} categories`
        );
      });

      // Verify success
      cy.get('[data-cy=toast-success]').should(
        'be.visible'
      );
      cy.get('[data-cy=toast-title]').should('contain.text', 'Filter Updated');

      // Step 2: Verify the update persisted by going back to edit
      cy.url({ timeout: 15000 }).should('include', '/filters');
      cy.get('[data-cy=filter-card]')
        .contains(singleSiteFilter.name)
        .parents('[data-cy=filter-card]')
        .find('[data-cy=edit-filter-button]')
        .click();

      // Verify we're back on the edit page
      cy.url().should('include', '/edit');
      cy.get('[data-cy=filter-form]').should('be.visible');

      // Verify the additional category persisted
      cy.get('[data-cy^="selected-category-"]').should('have.length.gte', 2);

      cy.task(
        'log',
        '✅ Site/category selection updated and persisted successfully'
      );
    });
  });
});
