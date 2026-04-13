import { Test, TestingModule } from '@nestjs/testing';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { CategoriesService } from '../../../src/categories/categories.service';
import { PrismaService } from '@dealscrapper/database';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: jest.Mocked<PrismaService>;
  let sharedConfigService: jest.Mocked<SharedConfigService>;

  // Mock category at level 0 (main tab)
  const mockLevel0Category = {
    id: 'category-0',
    slug: 'femmes',
    name: 'Femmes',
    siteId: 'vinted',
    sourceUrl: 'https://www.vinted.fr/catalog/femmes',
    parentId: null,
    level: 0,
    description: 'Main tab for women',
    dealCount: 500,
    avgTemperature: 70.0,
    popularBrands: ['Zara', 'H&M'],
    isActive: true,
    userCount: 100,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    site: { id: 'vinted', name: 'Vinted', color: '#09B1BA', isActive: true, iconUrl: null },
    parent: null,
  };

  const mockCategories = [
    {
      id: 'category-1',
      slug: 'pc-gaming',
      name: 'PC Gaming',
      siteId: 'dealabs',
      sourceUrl: 'https://www.dealabs.com/groupe/pc-gaming',
      parentId: null,
      level: 1,
      description: 'PC Gaming deals and hardware',
      dealCount: 150,
      avgTemperature: 75.5,
      popularBrands: ['NVIDIA', 'AMD', 'Intel'],
      isActive: true,
      userCount: 25,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      site: { id: 'dealabs', name: 'Dealabs', color: '#FF6B00', isActive: true, iconUrl: null },
      parent: null,
    },
    {
      id: 'category-2',
      slug: 'mobile-gaming',
      name: 'Mobile Gaming',
      siteId: 'dealabs',
      sourceUrl: 'https://www.dealabs.com/groupe/mobile-gaming',
      parentId: 'category-1',
      level: 2,
      description: 'Mobile gaming accessories and games',
      dealCount: 80,
      avgTemperature: 65.0,
      popularBrands: ['Apple', 'Samsung', 'Google'],
      isActive: true,
      userCount: 15,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      site: { id: 'dealabs', name: 'Dealabs', color: '#FF6B00', isActive: true, iconUrl: null },
      parent: { id: 'category-1', name: 'PC Gaming', parent: null },
    },
    {
      id: 'category-3',
      slug: 'electronics',
      name: 'Electronics',
      siteId: 'dealabs',
      sourceUrl: 'https://www.dealabs.com/groupe/electronics',
      parentId: null,
      level: 1,
      description: 'Consumer electronics and gadgets',
      dealCount: 200,
      avgTemperature: 80.0,
      popularBrands: ['Apple', 'Samsung', 'Sony'],
      isActive: true,
      userCount: 50,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      site: { id: 'dealabs', name: 'Dealabs', color: '#FF6B00', isActive: true, iconUrl: null },
      parent: null,
    },
  ];

  const mockPrismaService = {
    category: {
      findMany: jest.fn(),
    },
  };

  const mockSharedConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3004'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SharedConfigService, useValue: mockSharedConfigService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
    sharedConfigService = module.get(SharedConfigService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active categories when no search term is provided', async () => {
      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: undefined,
      });
      expect(result).toHaveLength(3);
    });

    it('should return filtered categories when search term is provided', async () => {
      const searchTerm = 'gaming';
      const filteredCategories = mockCategories.filter((cat) =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      prisma.category.findMany.mockResolvedValue(filteredCategories);

      const result = await service.findAll(searchTerm);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { level: 'asc' }],
        take: 50,
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no categories match search term', async () => {
      const searchTerm = 'nonexistent';
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll(searchTerm);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { level: 'asc' }],
        take: 50,
      });
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle empty search term by returning all categories', async () => {
      const searchTerm = '';
      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll(searchTerm);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: undefined,
      });
      expect(result).toHaveLength(3);
    });

    it('should handle whitespace-only search term by returning all categories', async () => {
      const searchTerm = '   ';
      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll(searchTerm);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: undefined,
      });
      expect(result).toHaveLength(3);
    });

    it('should search case-insensitively across name, slug, and description fields', async () => {
      const searchTerm = 'GAMING';
      const filteredCategories = mockCategories.slice(0, 2);

      prisma.category.findMany.mockResolvedValue(filteredCategories);

      const result = await service.findAll(searchTerm);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: 'gaming', mode: 'insensitive' } },
            { slug: { contains: 'gaming', mode: 'insensitive' } },
            { description: { contains: 'gaming', mode: 'insensitive' } },
          ],
        },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { level: 'asc' }],
        take: 50,
      });
      expect(result).toHaveLength(2);
    });

    it('should limit results to 50 categories for performance', async () => {
      const searchTerm = 'test';
      prisma.category.findMany.mockResolvedValue([]);

      await service.findAll(searchTerm);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }, { level: 'asc' }],
        take: 50,
      });
    });

    it('should order results by level then name for consistent hierarchy', async () => {
      prisma.category.findMany.mockResolvedValue(mockCategories);

      await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: undefined,
      });
    });

    it('should filter by site IDs when provided', async () => {
      prisma.category.findMany.mockResolvedValue(mockCategories);

      await service.findAll(undefined, ['dealabs', 'vinted']);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          siteId: { in: ['dealabs', 'vinted'] },
        },
        include: {
          site: true,
          // Include nested parent for building displayPath (up to grandparent for level 2)
          parent: {
            include: {
              parent: true,
            },
          },
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: undefined,
      });
    });

    it('should return categories with displayPath and isSelectable fields', async () => {
      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      // Check that all categories have the new fields
      expect(result).toHaveLength(3);

      // Level 1 category without parent
      const pcGaming = result.find(c => c.id === 'category-1');
      expect(pcGaming).toBeDefined();
      expect(pcGaming?.displayPath).toBe('PC Gaming'); // No parent, just name
      expect(pcGaming?.isSelectable).toBe(true); // Level 1 is selectable

      // Level 2 category with parent
      const mobileGaming = result.find(c => c.id === 'category-2');
      expect(mobileGaming).toBeDefined();
      expect(mobileGaming?.displayPath).toBe('PC Gaming → Mobile Gaming'); // Parent → Name
      expect(mobileGaming?.isSelectable).toBe(true); // Level 2 is selectable

      // Another level 1 category
      const electronics = result.find(c => c.id === 'category-3');
      expect(electronics).toBeDefined();
      expect(electronics?.displayPath).toBe('Electronics'); // No parent, just name
      expect(electronics?.isSelectable).toBe(true); // Level 1 is selectable
    });

    it('should mark level 0 categories as not selectable', async () => {
      prisma.category.findMany.mockResolvedValue([mockLevel0Category]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].displayPath).toBe('Femmes'); // Level 0, just name
      expect(result[0].isSelectable).toBe(false); // Level 0 is NOT selectable
    });
  });
});
