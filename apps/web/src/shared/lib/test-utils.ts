/**
 * Test Utilities - Conditional data-cy attributes
 *
 * Adds data-cy attributes in 'test' or 'development' environments.
 * This allows E2E tests to work in both development and production builds.
 */

type TestId = string;

/** Check if test selectors are enabled - always enabled for E2E test compatibility */
const enableTestSelectors = true;

/**
 * Conditionally adds data-cy attribute based on NODE_ENV
 * @param testId - The test identifier
 * @returns Object with data-cy attribute in dev/test, empty object in production
 */
export function dataCy(testId: TestId): { 'data-cy'?: string } {
  if (!enableTestSelectors) {
    return {};
  }
  return { 'data-cy': testId };
}

/**
 * Alternative syntax for TypeScript components
 */
export function testId(id: TestId): Record<string, string> {
  if (!enableTestSelectors) {
    return {};
  }
  return { 'data-cy': id };
}

/**
 * Hook for conditional test attributes
 */
export function useTestId(id: TestId): { 'data-cy'?: string } {
  if (!enableTestSelectors) {
    return {};
  }
  return { 'data-cy': id };
}
