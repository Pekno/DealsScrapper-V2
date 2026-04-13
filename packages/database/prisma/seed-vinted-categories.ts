import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Vinted category data seed
 * Based on Vinted.fr category structure (2025-01-19)
 *
 * Main categories for French secondhand fashion marketplace
 */
const vintedCategories = [
  {
    slug: '1904', // Main women's category ID
    name: 'Femmes',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=1904&order=newest_first',
    parentSlug: null, // Used for lookup during seeding
    level: 1,
    description: 'Vêtements, chaussures et accessoires pour femmes',
    isActive: true,
  },
  {
    slug: '1905',
    name: 'Hommes',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=1905&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Vêtements, chaussures et accessoires pour hommes',
    isActive: true,
  },
  {
    slug: '1906',
    name: 'Enfants',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=1906&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Vêtements et accessoires pour enfants',
    isActive: true,
  },
  {
    slug: '1930',
    name: 'Maison',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=1930&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Décoration et articles pour la maison',
    isActive: true,
  },
  {
    slug: '1940',
    name: 'Loisirs',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=1940&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Articles de sport, loisirs et divertissement',
    isActive: true,
  },
  {
    slug: '2050',
    name: 'Beauté',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=2050&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Produits de beauté et cosmétiques',
    isActive: true,
  },
  {
    slug: '3000',
    name: 'Accessoires',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=3000&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Sacs, bijoux et accessoires de mode',
    isActive: true,
  },
  {
    slug: '3100',
    name: 'Chaussures',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=3100&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Chaussures pour toute la famille',
    isActive: true,
  },
  {
    slug: '4000',
    name: 'Électronique',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=4000&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Électronique et technologie',
    isActive: true,
  },
  {
    slug: '5000',
    name: 'Livres & Musique',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=5000&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Livres, musique et divertissement',
    isActive: true,
  },
  {
    slug: '6000',
    name: 'Animaux',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=6000&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Accessoires et articles pour animaux',
    isActive: true,
  },
  {
    slug: '7000',
    name: 'Jouets',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog?catalog[]=7000&order=newest_first',
    parentSlug: null,
    level: 1,
    description: 'Jouets et jeux pour enfants',
    isActive: true,
  },
];

/**
 * Lookup parent category ID by siteId and slug
 */
async function getParentId(
  siteId: string,
  parentSlug: string | null
): Promise<string | null> {
  if (!parentSlug) return null;

  const parent = await prisma.category.findFirst({
    where: { siteId, slug: parentSlug },
  });

  return parent?.id ?? null;
}

async function seedVintedCategories() {
  console.log('🌱 Seeding Vinted categories...');

  // Ensure the Site exists first
  await prisma.site.upsert({
    where: { id: 'vinted' },
    update: {},
    create: {
      id: 'vinted',
      name: 'Vinted',
      color: '#09B1BA',
      isActive: true,
    },
  });

  // First pass: seed level 1 categories (no parent)
  const level1Categories = vintedCategories.filter((c) => c.level === 1);
  for (const category of level1Categories) {
    try {
      const result = await prisma.category.upsert({
        where: {
          siteId_sourceUrl: {
            siteId: category.siteId,
            sourceUrl: category.sourceUrl,
          },
        },
        update: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          isActive: category.isActive,
        },
        create: {
          slug: category.slug,
          name: category.name,
          siteId: category.siteId,
          sourceUrl: category.sourceUrl,
          level: category.level,
          description: category.description,
          isActive: category.isActive,
        },
      });

      console.log(`✅ ${result.name} (${result.slug}) - ${result.id}`);
    } catch (error) {
      console.error(`❌ Failed to seed category ${category.slug}:`, error);
    }
  }

  // Second pass: seed level 2+ categories (with parent lookup)
  const subCategories = vintedCategories.filter((c) => c.level > 1);
  for (const category of subCategories) {
    try {
      const parentId = await getParentId(category.siteId, category.parentSlug);

      const result = await prisma.category.upsert({
        where: {
          siteId_sourceUrl: {
            siteId: category.siteId,
            sourceUrl: category.sourceUrl,
          },
        },
        update: {
          name: category.name,
          slug: category.slug,
          parentId,
          description: category.description,
          isActive: category.isActive,
        },
        create: {
          slug: category.slug,
          name: category.name,
          siteId: category.siteId,
          sourceUrl: category.sourceUrl,
          parentId,
          level: category.level,
          description: category.description,
          isActive: category.isActive,
        },
      });

      console.log(`✅ ${result.name} (${result.slug}) - ${result.id}`);
    } catch (error) {
      console.error(`❌ Failed to seed category ${category.slug}:`, error);
    }
  }

  console.log('');
  console.log('✨ Vinted categories seeded successfully!');

  // Verify seeding
  const count = await prisma.category.count({
    where: { siteId: 'vinted' },
  });

  console.log(`📊 Total Vinted categories in database: ${count}`);
}

async function main() {
  try {
    await seedVintedCategories();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
