import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * LeBonCoin category data seed
 * Based on LeBonCoin.fr category structure (2025-01-19)
 *
 * LeBonCoin uses numeric category IDs with hierarchical structure:
 * - Level 1: Main categories (e.g., "9" = Immobilier)
 * - Level 2: Subcategories (e.g., "10" = Ventes immobilières)
 * - Level 3: Specific categories (e.g., "11" = Appartements)
 *
 * Category structure based on https://www.leboncoin.fr
 */
const leboncoinCategories = [
  // ===== MAIN CATEGORY: Immobilier (Real Estate) =====
  {
    slug: '9',
    name: 'Immobilier',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=9',
    parentSlug: null,
    level: 1,
    description: 'Ventes et locations immobilières',
    isActive: true,
  },
  {
    slug: '10',
    name: 'Ventes immobilières',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=10',
    parentSlug: '9',
    level: 2,
    description: 'Appartements, maisons et terrains à vendre',
    isActive: true,
  },
  {
    slug: '11',
    name: 'Locations',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=11',
    parentSlug: '9',
    level: 2,
    description: 'Appartements et maisons à louer',
    isActive: true,
  },
  {
    slug: '13',
    name: 'Colocations',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=13',
    parentSlug: '9',
    level: 2,
    description: 'Recherche de colocataires',
    isActive: true,
  },
  {
    slug: '14',
    name: 'Bureaux & Commerces',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=14',
    parentSlug: '9',
    level: 2,
    description: 'Locaux professionnels à vendre ou à louer',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Véhicules (Vehicles) =====
  {
    slug: '2',
    name: 'Véhicules',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=2',
    parentSlug: null,
    level: 1,
    description: 'Voitures, motos, caravaning et utilitaires',
    isActive: true,
  },
  {
    slug: '3',
    name: 'Voitures',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=3',
    parentSlug: '2',
    level: 2,
    description: "Véhicules particuliers d'occasion",
    isActive: true,
  },
  {
    slug: '4',
    name: 'Motos',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=4',
    parentSlug: '2',
    level: 2,
    description: 'Motos, scooters et quads',
    isActive: true,
  },
  {
    slug: '5',
    name: 'Caravaning',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=5',
    parentSlug: '2',
    level: 2,
    description: 'Camping-cars, caravanes et mobil-homes',
    isActive: true,
  },
  {
    slug: '6',
    name: 'Utilitaires',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=6',
    parentSlug: '2',
    level: 2,
    description: 'Camionnettes et véhicules professionnels',
    isActive: true,
  },
  {
    slug: '7',
    name: 'Équipement Auto',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=7',
    parentSlug: '2',
    level: 2,
    description: 'Pièces détachées et accessoires automobiles',
    isActive: true,
  },
  {
    slug: '8',
    name: 'Équipement Moto',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=8',
    parentSlug: '2',
    level: 2,
    description: 'Pièces détachées et accessoires moto',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Mode (Fashion) =====
  {
    slug: '15',
    name: 'Mode',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=15',
    parentSlug: null,
    level: 1,
    description: 'Vêtements, chaussures et accessoires de mode',
    isActive: true,
  },
  {
    slug: '16',
    name: 'Vêtements',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=16',
    parentSlug: '15',
    level: 2,
    description: 'Vêtements pour femmes, hommes et enfants',
    isActive: true,
  },
  {
    slug: '17',
    name: 'Chaussures',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=17',
    parentSlug: '15',
    level: 2,
    description: 'Chaussures pour toute la famille',
    isActive: true,
  },
  {
    slug: '18',
    name: 'Accessoires & Bagagerie',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=18',
    parentSlug: '15',
    level: 2,
    description: 'Sacs, bijoux, montres et accessoires',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Maison (Home) =====
  {
    slug: '19',
    name: 'Maison',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=19',
    parentSlug: null,
    level: 1,
    description: 'Meubles, décoration et électroménager',
    isActive: true,
  },
  {
    slug: '20',
    name: 'Ameublement',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=20',
    parentSlug: '19',
    level: 2,
    description: 'Meubles pour toute la maison',
    isActive: true,
  },
  {
    slug: '21',
    name: 'Électroménager',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=21',
    parentSlug: '19',
    level: 2,
    description: 'Réfrigérateurs, lave-linge, four, etc.',
    isActive: true,
  },
  {
    slug: '22',
    name: 'Arts de la table',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=22',
    parentSlug: '19',
    level: 2,
    description: 'Vaisselle, couverts et ustensiles de cuisine',
    isActive: true,
  },
  {
    slug: '23',
    name: 'Décoration',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=23',
    parentSlug: '19',
    level: 2,
    description: 'Objets déco, tableaux et luminaires',
    isActive: true,
  },
  {
    slug: '24',
    name: 'Linge de maison',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=24',
    parentSlug: '19',
    level: 2,
    description: 'Draps, rideaux et linge de lit',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Multimédia (Electronics) =====
  {
    slug: '25',
    name: 'Multimédia',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=25',
    parentSlug: null,
    level: 1,
    description: 'Informatique, téléphonie et high-tech',
    isActive: true,
  },
  {
    slug: '26',
    name: 'Informatique',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=26',
    parentSlug: '25',
    level: 2,
    description: 'Ordinateurs, tablettes et accessoires',
    isActive: true,
  },
  {
    slug: '27',
    name: 'Consoles & Jeux vidéo',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=27',
    parentSlug: '25',
    level: 2,
    description: 'PlayStation, Xbox, Nintendo et jeux',
    isActive: true,
  },
  {
    slug: '28',
    name: 'Image & Son',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=28',
    parentSlug: '25',
    level: 2,
    description: 'TV, home cinéma, appareils photo',
    isActive: true,
  },
  {
    slug: '29',
    name: 'Téléphonie',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=29',
    parentSlug: '25',
    level: 2,
    description: 'Smartphones et accessoires',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Loisirs (Leisure) =====
  {
    slug: '30',
    name: 'Loisirs',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=30',
    parentSlug: null,
    level: 1,
    description: 'Sport, vélos, livres et instruments de musique',
    isActive: true,
  },
  {
    slug: '31',
    name: 'Vélos',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=31',
    parentSlug: '30',
    level: 2,
    description: 'VTT, vélos de route et électriques',
    isActive: true,
  },
  {
    slug: '32',
    name: 'Sports & Hobbies',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=32',
    parentSlug: '30',
    level: 2,
    description: 'Équipements sportifs et loisirs créatifs',
    isActive: true,
  },
  {
    slug: '33',
    name: 'Instruments de musique',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=33',
    parentSlug: '30',
    level: 2,
    description: 'Guitares, pianos et équipement audio',
    isActive: true,
  },
  {
    slug: '34',
    name: 'Livres, CD & DVD',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=34',
    parentSlug: '30',
    level: 2,
    description: 'Livres, films et musique',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Matériel professionnel =====
  {
    slug: '35',
    name: 'Matériel professionnel',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=35',
    parentSlug: null,
    level: 1,
    description: 'Équipement pour professionnels et entreprises',
    isActive: true,
  },
  {
    slug: '36',
    name: 'Matériel agricole',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=36',
    parentSlug: '35',
    level: 2,
    description: 'Tracteurs et équipement agricole',
    isActive: true,
  },
  {
    slug: '37',
    name: 'Transport - Manutention',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=37',
    parentSlug: '35',
    level: 2,
    description: 'Chariots élévateurs et équipement logistique',
    isActive: true,
  },
  {
    slug: '38',
    name: 'BTP - Chantier',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=38',
    parentSlug: '35',
    level: 2,
    description: 'Outillage et engins de chantier',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Services =====
  {
    slug: '39',
    name: 'Services',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=39',
    parentSlug: null,
    level: 1,
    description: 'Prestations de services entre particuliers',
    isActive: true,
  },
  {
    slug: '40',
    name: 'Prestations de services',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=40',
    parentSlug: '39',
    level: 2,
    description: 'Services divers entre particuliers',
    isActive: true,
  },
  {
    slug: '41',
    name: 'Billetterie',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=41',
    parentSlug: '39',
    level: 2,
    description: 'Tickets concerts, spectacles et événements',
    isActive: true,
  },
  {
    slug: '42',
    name: 'Évènements',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=42',
    parentSlug: '39',
    level: 2,
    description: "Annonces d'événements locaux",
    isActive: true,
  },

  // ===== MAIN CATEGORY: Animaux (Pets) =====
  {
    slug: '43',
    name: 'Animaux',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=43',
    parentSlug: null,
    level: 1,
    description: 'Animaux et accessoires pour animaux de compagnie',
    isActive: true,
  },
  {
    slug: '44',
    name: 'Chiens',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=44',
    parentSlug: '43',
    level: 2,
    description: 'Chiens à adopter et accessoires',
    isActive: true,
  },
  {
    slug: '45',
    name: 'Chats',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=45',
    parentSlug: '43',
    level: 2,
    description: 'Chats à adopter et accessoires',
    isActive: true,
  },
  {
    slug: '46',
    name: 'Accessoires animaux',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=46',
    parentSlug: '43',
    level: 2,
    description: 'Cages, litières, jouets et nourriture',
    isActive: true,
  },

  // ===== MAIN CATEGORY: Emploi (Jobs) =====
  {
    slug: '47',
    name: 'Emploi',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=47',
    parentSlug: null,
    level: 1,
    description: "Offres d'emploi et stages",
    isActive: true,
  },
  {
    slug: '48',
    name: "Offres d'emploi",
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=48',
    parentSlug: '47',
    level: 2,
    description: 'CDI, CDD et missions intérim',
    isActive: true,
  },
  {
    slug: '49',
    name: 'Stages & Apprentissages',
    siteId: 'leboncoin',
    sourceUrl: 'https://www.leboncoin.fr/recherche?category=49',
    parentSlug: '47',
    level: 2,
    description: 'Offres de stages et alternances',
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

/**
 * Seed LeBonCoin categories into database
 */
async function seedLeBonCoinCategories() {
  console.log('🌱 Seeding LeBonCoin categories...');
  console.log('');

  // Ensure the Site exists first
  await prisma.site.upsert({
    where: { id: 'leboncoin' },
    update: {},
    create: {
      id: 'leboncoin',
      name: 'LeBonCoin',
      color: '#FF6E14',
      isActive: true,
    },
  });

  let successCount = 0;
  let errorCount = 0;

  // First pass: seed level 1 categories (no parent)
  const level1Categories = leboncoinCategories.filter((c) => c.level === 1);
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
          level: category.level,
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

      console.log(`✅ ${result.name} (${result.slug}) - Level ${result.level}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to seed category ${category.slug}:`, error);
      errorCount++;
    }
  }

  // Second pass: seed level 2+ categories (with parent lookup)
  const subCategories = leboncoinCategories.filter((c) => c.level > 1);
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
          level: category.level,
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

      const indent = '  '.repeat(category.level - 1);
      console.log(
        `✅ ${indent}${result.name} (${result.slug}) - Level ${result.level}`
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to seed category ${category.slug}:`, error);
      errorCount++;
    }
  }

  console.log('');
  console.log('✨ LeBonCoin categories seeded successfully!');
  console.log('');

  // Verify seeding and show statistics
  const count = await prisma.category.count({
    where: { siteId: 'leboncoin' },
  });

  const level1Count = await prisma.category.count({
    where: { siteId: 'leboncoin', level: 1 },
  });

  const level2Count = await prisma.category.count({
    where: { siteId: 'leboncoin', level: 2 },
  });

  console.log('📊 Seeding Statistics:');
  console.log(`   Total categories: ${count}`);
  console.log(`   Level 1 (Main): ${level1Count}`);
  console.log(`   Level 2 (Sub): ${level2Count}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('');

  // Show hierarchy tree
  console.log('🌳 Category Hierarchy:');
  const mainCategories = await prisma.category.findMany({
    where: { siteId: 'leboncoin', level: 1 },
  });

  for (const main of mainCategories) {
    console.log(`   📁 ${main.name}`);

    const subCats = await prisma.category.findMany({
      where: { siteId: 'leboncoin', parentId: main.id },
    });

    for (const sub of subCats) {
      console.log(`      └─ ${sub.name}`);
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    await seedLeBonCoinCategories();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
