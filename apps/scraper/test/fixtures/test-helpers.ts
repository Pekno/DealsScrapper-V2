import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { RawDeal } from '@dealscrapper/shared-types';

/**
 * Load HTML fixture from service test fixtures directory
 */
export function loadHtmlFixture(filename: string): string {
  // Load from current directory (test/fixtures) or resolve from project root
  const fixturePath = join(__dirname, filename);
  return readFileSync(fixturePath, 'utf8');
}

/**
 * Load expected deals from service test fixtures directory
 */
export function loadExpectedDeals(filename: string): RawDeal[] {
  // Load from current directory (test/fixtures) or resolve from project root
  const fixturePath = join(__dirname, filename);
  const jsonContent = readFileSync(fixturePath, 'utf8');
  return JSON.parse(jsonContent);
}

/**
 * Compare extracted deal with expected deal
 */
export function compareDeals(
  extracted: RawDeal,
  expected: RawDeal
): {
  isMatch: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  // Required fields to check
  const requiredFields: (keyof RawDeal)[] = [
    'externalId',
    'title',
    'category',
    // 'categoryPath', // Removed as it's fixed based on scraping source
    'currentPrice',
    'merchant',
    'freeShipping',
    'temperature',
    'commentCount',
    'communityVerified',
    'url',
    'imageUrl',
    'isExpired',
    'isCoupon',
    'source',
    'isActive',
  ];

  // Optional fields to check if present
  const optionalFields: (keyof RawDeal)[] = [
    'description',
    'originalPrice',
    'discountPercentage',
    'discountAmount',
    'storeLocation',
    'publishedAt',
    'expiresAt',
  ];

  // Check required fields
  for (const field of requiredFields) {
    if (extracted[field] !== expected[field]) {
      // Special handling for arrays
      if (Array.isArray(expected[field])) {
        const extractedArray = extracted[field] as any[];
        const expectedArray = expected[field] as any[];

        if (!extractedArray) {
          differences.push(`${field}: expected array, got undefined`);
        } else {
          // For other arrays, check exact match
          if (extractedArray.length !== expectedArray.length) {
            differences.push(
              `${field}: length mismatch - expected ${expectedArray.length}, got ${extractedArray?.length || 0}`
            );
          } else {
            for (let i = 0; i < expectedArray.length; i++) {
              if (extractedArray[i] !== expectedArray[i]) {
                differences.push(
                  `${field}[${i}]: expected "${expectedArray[i]}", got "${extractedArray[i]}"`
                );
              }
            }
          }
        }
      } else {
        differences.push(
          `${field}: expected "${expected[field]}", got "${extracted[field]}"`
        );
      }
    }
  }

  // Check optional fields if they exist in expected
  for (const field of optionalFields) {
    if (expected[field] !== undefined) {
      if (extracted[field] !== expected[field]) {
        // Special handling for arrays
        if (Array.isArray(expected[field])) {
          const extractedArray = extracted[field] as any[];
          const expectedArray = expected[field] as any[];

          if (!extractedArray) {
            differences.push(`${field}: expected array, got undefined`);
          } else {
            // For other arrays, check exact match
            if (extractedArray.length !== expectedArray.length) {
              differences.push(
                `${field}: length mismatch - expected ${expectedArray.length}, got ${extractedArray?.length || 0}`
              );
            } else {
              for (let i = 0; i < expectedArray.length; i++) {
                if (extractedArray[i] !== expectedArray[i]) {
                  differences.push(
                    `${field}[${i}]: expected "${expectedArray[i]}", got "${extractedArray[i]}"`
                  );
                }
              }
            }
          }
        } else {
          // Special handling for dates
          if (field === 'publishedAt' || field === 'expiresAt') {
            const extractedDate = extracted[field] as Date;
            const expectedDate = expected[field] as Date;

            if (extractedDate instanceof Date && expectedDate instanceof Date) {
              const extractedISO = extractedDate.toISOString();
              const expectedISO = expectedDate.toISOString();
              if (extractedISO !== expectedISO) {
                differences.push(
                  `${field}: expected "${expectedISO}", got "${extractedISO}"`
                );
              }
            } else {
              differences.push(
                `${field}: expected "${expected[field]}", got "${extracted[field]}"`
              );
            }
          } else {
            differences.push(
              `${field}: expected "${expected[field]}", got "${extracted[field]}"`
            );
          }
        }
      }
    }
  }

  return {
    isMatch: differences.length === 0,
    differences,
  };
}

/**
 * Find deal in extracted deals by external ID
 */
export function findDealById(
  deals: RawDeal[],
  externalId: string
): RawDeal | undefined {
  return deals.find((deal) => deal.externalId === externalId);
}

/**
 * Create detailed comparison report
 */
export function createComparisonReport(
  extracted: RawDeal[],
  expected: RawDeal[]
): {
  totalExpected: number;
  totalExtracted: number;
  matches: number;
  missing: string[];
  extra: string[];
  differences: Array<{ id: string; differences: string[] }>;
} {
  const report = {
    totalExpected: expected.length,
    totalExtracted: extracted.length,
    matches: 0,
    missing: [] as string[],
    extra: [] as string[],
    differences: [] as Array<{ id: string; differences: string[] }>,
  };

  // Check for matches and differences
  for (const expectedDeal of expected) {
    const extractedDeal = findDealById(extracted, expectedDeal.externalId);

    if (!extractedDeal) {
      report.missing.push(expectedDeal.externalId);
    } else {
      const comparison = compareDeals(extractedDeal, expectedDeal);
      if (comparison.isMatch) {
        report.matches++;
      } else {
        report.differences.push({
          id: expectedDeal.externalId,
          differences: comparison.differences,
        });
      }
    }
  }

  // Check for extra deals
  for (const extractedDeal of extracted) {
    const expectedDeal = findDealById(expected, extractedDeal.externalId);
    if (!expectedDeal) {
      report.extra.push(extractedDeal.externalId);
    }
  }

  return report;
}

/**
 * Assert that deals match expectations
 */
export function assertDealsMatch(
  extracted: RawDeal[],
  expected: RawDeal[],
  options: {
    allowExtra?: boolean;
    allowMissing?: boolean;
    maxDifferences?: number;
  } = {}
): void {
  const report = createComparisonReport(extracted, expected);

  const errors: string[] = [];

  if (!options.allowMissing && report.missing.length > 0) {
    errors.push(`Missing deals: ${report.missing.join(', ')}`);
  }

  if (!options.allowExtra && report.extra.length > 0) {
    errors.push(`Extra deals: ${report.extra.join(', ')}`);
  }

  if (report.differences.length > 0) {
    const maxDiff = options.maxDifferences || 0;
    if (report.differences.length > maxDiff) {
      errors.push(
        `Too many differences (${report.differences.length}/${maxDiff})`
      );
    }

    for (const diff of report.differences) {
      errors.push(`Deal ${diff.id}: ${diff.differences.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Deal extraction mismatch:\n${errors.join('\n')}`);
  }
}

/**
 * Print comparison report using NestJS Logger
 */
export function printComparisonReport(
  extracted: RawDeal[],
  expected: RawDeal[]
): void {
  const logger = new Logger('TestHelpers');
  const report = createComparisonReport(extracted, expected);

  logger.log('\n=== Deal Extraction Comparison Report ===');
  logger.log(`Expected: ${report.totalExpected} deals`);
  logger.log(`Extracted: ${report.totalExtracted} deals`);
  logger.log(`Matches: ${report.matches} deals`);

  if (report.missing.length > 0) {
    logger.log(`Missing: ${report.missing.join(', ')}`);
  }

  if (report.extra.length > 0) {
    logger.log(`Extra: ${report.extra.join(', ')}`);
  }

  if (report.differences.length > 0) {
    logger.log(`\nDifferences:`);
    for (const diff of report.differences) {
      logger.log(`  ${diff.id}:`);
      for (const difference of diff.differences) {
        logger.log(`    - ${difference}`);
      }
    }
  }

  logger.log('==========================================\n');
}
