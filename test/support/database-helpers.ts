/**
 * Database Helper Functions for Cypress Tests
 *
 * Provides database operations for test setup and cleanup
 */

import { PrismaClient } from '@prisma/client';
import { Client } from '@elastic/elasticsearch';

// Initialize Prisma client for test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.CYPRESS_DATABASE_URL ||
        'postgresql://test:test@localhost:5433/dealscrapper_test',
    },
  },
});

// Initialize ElasticSearch client for test cleanup
const elasticsearchClient = new Client({
  node:
    process.env.CYPRESS_ELASTICSEARCH_URL ||
    process.env.ELASTICSEARCH_NODE ||
    'http://localhost:9201',
});

/**
 * Get default site configuration for test data creation
 */
function getSiteDefaults(siteId: string): {
  id: string;
  name: string;
  baseUrl: string;
  categoryDiscoveryUrl: string;
  color: string;
  isActive: boolean;
} {
  const siteConfigs: Record<
    string,
    {
      name: string;
      baseUrl: string;
      categoryDiscoveryUrl: string;
      color: string;
    }
  > = {
    dealabs: {
      name: 'Dealabs',
      baseUrl: 'https://www.dealabs.com',
      categoryDiscoveryUrl: 'https://www.dealabs.com/groupe/',
      color: '#FF7900',
    },
    vinted: {
      name: 'Vinted',
      baseUrl: 'https://www.vinted.fr',
      categoryDiscoveryUrl: 'https://www.vinted.fr/catalog',
      color: '#09B1BA',
    },
    leboncoin: {
      name: 'LeBonCoin',
      baseUrl: 'https://www.leboncoin.fr',
      categoryDiscoveryUrl: 'https://www.leboncoin.fr/recherche',
      color: '#FF6E14',
    },
  };

  const config = siteConfigs[siteId] || {
    name: siteId.charAt(0).toUpperCase() + siteId.slice(1),
    baseUrl: `https://www.${siteId}.com`,
    categoryDiscoveryUrl: `https://www.${siteId}.com/categories`,
    color: '#FF7900',
  };

  return {
    id: siteId,
    ...config,
    isActive: true,
  };
}

/**
 * Clean up database for tests
 * Removes all test data while preserving schema
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    // Delete in order to respect foreign key constraints
    // Note: We preserve the default user@example.com for development/testing

    // Get the preserved user IDs (default user + default admin)
    const preservedEmails = ['user@example.com', 'admin@example.com'];
    const preservedUsers = await prisma.user.findMany({
      where: { email: { in: preservedEmails } },
    });
    const preservedUserIds = preservedUsers.map((u) => u.id);

    await prisma.notification.deleteMany({
      where:
        preservedUserIds.length > 0
          ? {
              userId: { notIn: preservedUserIds },
            }
          : {},
    });

    // Delete ALL matches before articles due to FK constraint
    // Even preserved users' matches must be deleted since we're cleaning all articles
    await prisma.match.deleteMany();

    // Clean up articles to ensure fresh data for each test run
    await prisma.article.deleteMany();
    await prisma.scrapingJob.deleteMany();

    await prisma.filterCategory.deleteMany({
      where:
        preservedUserIds.length > 0
          ? {
              filter: {
                userId: { notIn: preservedUserIds },
              },
            }
          : {},
    });

    await prisma.filter.deleteMany({
      where:
        preservedUserIds.length > 0
          ? {
              userId: { notIn: preservedUserIds },
            }
          : {},
    });

    //await prisma.category.deleteMany();

    // Delete all users except the preserved ones
    await prisma.user.deleteMany({
      where: {
        email: { notIn: preservedEmails },
      },
    });

    console.log(
      '✅ Database cleaned up successfully (preserved user@example.com and admin@example.com)'
    );

    // Also clean up ElasticSearch indices
    await cleanupElasticsearch();
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  }
}

/**
 * Clean up ElasticSearch indices for tests
 * Removes all deals and deal-evolution data from ElasticSearch
 */
export async function cleanupElasticsearch(): Promise<void> {
  try {
    console.log('🔍 Cleaning up ElasticSearch indices...');

    // Delete all documents from deals and evolution indices
    // We use patterns to match all indices with the prefix
    const indicesToClean = ['deals-*', 'deal-evolution-*'];

    for (const indexPattern of indicesToClean) {
      try {
        // Check if indices matching the pattern exist
        const existsResult = await elasticsearchClient.indices.exists({
          index: indexPattern,
        });

        if (existsResult) {
          // Delete all documents in matching indices using deleteByQuery
          await elasticsearchClient.deleteByQuery({
            index: indexPattern,
            query: {
              match_all: {},
            },
            // Refresh immediately to make changes visible
            refresh: true,
          });

          console.log(
            `✅ ElasticSearch cleanup: Cleared all documents from ${indexPattern}`
          );
        } else {
          console.log(
            `ℹ️ ElasticSearch cleanup: No indices found matching ${indexPattern}`
          );
        }
      } catch (indexError: any) {
        // If index doesn't exist, that's fine - it means it's already clean
        if (indexError.meta?.statusCode === 404) {
          console.log(
            `ℹ️ ElasticSearch cleanup: Index pattern ${indexPattern} not found (already clean)`
          );
        } else {
          console.warn(
            `⚠️ ElasticSearch cleanup warning for ${indexPattern}:`,
            indexError.message
          );
        }
      }
    }

    console.log('✅ ElasticSearch indices cleaned up successfully');
  } catch (error) {
    console.error('❌ ElasticSearch cleanup failed:', error);
    // Don't throw - ES cleanup failure shouldn't block database cleanup
    console.warn(
      '⚠️ Continuing despite ElasticSearch cleanup failure (ES might not be available)'
    );
  }
}

/**
 * Ensure default development user exists
 * Creates the default user@example.com if it doesn't exist
 */
export async function ensureDefaultUser(): Promise<any> {
  try {
    // Check if default user already exists
    let defaultUser = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    });

    if (!defaultUser) {
      // Create the default development user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('StrongP@ssw0rd', 10);

      defaultUser = await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          firstName: 'John',
          lastName: 'Doe',
          emailVerified: true, // Default user is pre-verified
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('✅ Created default development user: user@example.com');
    } else {
      console.log(
        '✅ Default development user already exists: user@example.com'
      );
    }

    return defaultUser;
  } catch (error) {
    console.error('❌ Default user creation failed:', error);
    throw error;
  }
}

/**
 * Ensure default admin user exists
 * Creates the default admin@example.com if it doesn't exist
 */
export async function ensureDefaultAdminUser(): Promise<any> {
  try {
    let adminUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    if (!adminUser) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('AdminP@ssw0rd', 10);

      adminUser = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          emailVerified: true,
          role: 'ADMIN',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('✅ Created default admin user: admin@example.com');
    } else {
      // Ensure the user has ADMIN role (in case it was reset)
      if (adminUser.role !== 'ADMIN') {
        adminUser = await prisma.user.update({
          where: { email: 'admin@example.com' },
          data: { role: 'ADMIN' },
        });
        console.log('✅ Restored ADMIN role for admin@example.com');
      } else {
        console.log(
          '✅ Default admin user already exists: admin@example.com'
        );
      }
    }

    return adminUser;
  } catch (error) {
    console.error('❌ Default admin user creation failed:', error);
    throw error;
  }
}

/**
 * Create a test user in the database
 * @param userData User data to create
 * @returns Created user object
 */
export async function createTestUser(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  emailVerified?: boolean;
}): Promise<any> {
  try {
    // For simplicity, we'll use bcrypt to hash the password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        emailVerified: userData.emailVerified || false,
        updatedAt: new Date(),
      },
      create: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        emailVerified: userData.emailVerified || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Test user created/updated: ${user.email}`);
    return user;
  } catch (error) {
    console.error('❌ Test user creation failed:', error);
    throw error;
  }
}

/**
 * Create an admin test user in the database
 * @param userData User data to create with ADMIN role
 * @returns Created admin user object
 */
export async function createAdminUser(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  emailVerified?: boolean;
}): Promise<any> {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        emailVerified: userData.emailVerified ?? true,
        role: 'ADMIN',
        updatedAt: new Date(),
      },
      create: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        emailVerified: userData.emailVerified ?? true,
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Admin test user created/updated: ${user.email}`);
    return user;
  } catch (error) {
    console.error('❌ Admin test user creation failed:', error);
    throw error;
  }
}

/**
 * Create test categories for filter testing
 * Creates specific categories that can be used in filter rule testing
 * Categories now use compound unique key (siteId + sourceUrl) for multi-site support
 */
export async function createTestCategories(): Promise<any[]> {
  try {
    console.log('📂 Creating test categories...');

    // Ensure the dealabs site exists first
    const siteDefaults = getSiteDefaults('dealabs');
    await prisma.site.upsert({
      where: { id: 'dealabs' },
      update: {},
      create: siteDefaults,
    });
    console.log('✅ Site dealabs ensured');

    const testCategories = [
      {
        name: 'Accessoires gaming',
        slug: 'accessoires-gaming',
        siteId: 'dealabs',
        sourceUrl: 'https://www.dealabs.com/groupe/accessoires-gaming',
        description: 'Gaming accessories for testing',
      },
      {
        name: 'High-Tech',
        slug: 'high-tech',
        siteId: 'dealabs',
        sourceUrl: 'https://www.dealabs.com/groupe/high-tech',
        description: 'Technology products for testing',
      },
      {
        name: 'Jeux vidéo',
        slug: 'jeux-video',
        siteId: 'dealabs',
        sourceUrl: 'https://www.dealabs.com/groupe/jeux-video',
        description: 'Video games for testing',
      },
    ];

    const categories = [];

    for (const categoryData of testCategories) {
      console.log(
        `📂 Creating category: ${categoryData.name} (siteId: ${categoryData.siteId}, slug: ${categoryData.slug})`
      );
      const category = await prisma.category.upsert({
        where: {
          siteId_sourceUrl: {
            siteId: categoryData.siteId,
            sourceUrl: categoryData.sourceUrl,
          },
        },
        update: {
          name: categoryData.name,
          slug: categoryData.slug,
          description: categoryData.description,
          isActive: true,
        },
        create: {
          name: categoryData.name,
          slug: categoryData.slug,
          siteId: categoryData.siteId,
          sourceUrl: categoryData.sourceUrl,
          description: categoryData.description,
          isActive: true,
        },
      });
      categories.push(category);
      console.log(`✅ Category created: ${category.name} (ID: ${category.id})`);
    }

    console.log(`✅ Created ${categories.length} test categories`);
    return categories;
  } catch (error) {
    console.error('❌ Test categories creation failed:', error);
    throw error;
  }
}

/**
 * Create test filter with predefined rules
 * Creates a filter that matches fixture data for reliable testing
 */
export async function createTestFilter(
  userId: string,
  filterData: {
    name: string;
    description?: string;
    categoryIds?: string[];
    rules?: Array<{
      field: string;
      operator: string;
      value: string;
    }>;
  }
): Promise<any> {
  try {
    const filter = await prisma.filter.create({
      data: {
        name: filterData.name,
        description:
          filterData.description || 'Test filter created from fixture data',
        userId: userId,
        active: true,
        filterExpression: { type: 'and', conditions: [] }, // Simple placeholder
      },
    });

    // Add category associations
    if (filterData.categoryIds) {
      for (const categoryId of filterData.categoryIds) {
        await prisma.filterCategory.create({
          data: {
            filterId: filter.id,
            categoryId: categoryId,
          },
        });
      }
    }

    // Note: Filter rules are now stored in the filterExpression JSON field

    console.log(`✅ Created test filter: ${filter.name}`);
    return filter;
  } catch (error) {
    console.error('❌ Test filter creation failed:', error);
    throw error;
  }
}

/**
 * Clean up filters for a specific user
 * Removes all filters created by the specified user email
 */
export async function cleanupTestFilters(userEmail: string): Promise<void> {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.log(`⚠️ User ${userEmail} not found, skipping filter cleanup`);
      return;
    }

    // Delete filter-related data in correct order to respect foreign key constraints

    // Delete notifications for user's filters
    await prisma.notification.deleteMany({
      where: { userId: user.id },
    });

    // Delete matches for user's filters
    await prisma.match.deleteMany({
      where: {
        filter: { userId: user.id },
      },
    });

    // Delete filter categories for user's filters
    await prisma.filterCategory.deleteMany({
      where: {
        filter: { userId: user.id },
      },
    });

    // Delete the user's filters
    const deletedFilters = await prisma.filter.deleteMany({
      where: { userId: user.id },
    });

    console.log(
      `✅ Cleaned up ${deletedFilters.count} filters for user: ${userEmail}`
    );
  } catch (error) {
    console.error(`❌ Filter cleanup failed for user ${userEmail}:`, error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
