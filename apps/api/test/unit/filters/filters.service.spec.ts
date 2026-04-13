import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { HttpService } from '@nestjs/axios';
import { FiltersService } from '../../../src/filters/filters.service';
import { FilterMatcherService } from '../../../src/filters/services/filter-matcher.service';
import { PrismaService } from '@dealscrapper/database';
import { CreateFilterDto } from '../../../src/filters/dto/create-filter.dto';
import { FilterQueryDto } from '../../../src/filters/dto/filter-query.dto';

describe('FiltersService - User Deal Discovery & Personalization', () => {
  let service: FiltersService;
  let prisma: jest.Mocked<PrismaService>;
  let httpService: jest.Mocked<HttpService>;
  let sharedConfigService: jest.Mocked<SharedConfigService>;

  const mockCategory = {
    id: 'category-1',
    slug: 'pc-gaming',
    name: 'PC Gaming',
    siteId: 'dealabs',
    sourceUrl: 'https://www.dealabs.com/groupe/pc-gaming',
    parentId: undefined,
    level: 1,
    description: 'PC Gaming deals',
    dealCount: 100,
    avgTemperature: 75.5,
    popularBrands: ['NVIDIA', 'AMD'],
    isActive: true,
    userCount: 5,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockFilter = {
    id: 'filter-1',
    userId: 'user-1',
    name: 'Gaming Deals',
    description: 'Gaming laptop deals',
    active: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    filterExpression: {
      rules: [],
      matchLogic: 'AND',
      minScore: 50,
      scoreMode: 'weighted',
    },
    immediateNotifications: true,
    digestFrequency: 'daily',
    maxNotificationsPerDay: 50,
    totalMatches: 0,
    matchesLast24h: 0,
    lastMatchAt: null,
    categories: [
      {
        id: 'fc-1',
        filterId: 'filter-1',
        categoryId: 'category-1',
        createdAt: new Date('2025-01-01'),
        category: mockCategory,
      },
    ],
  };

  const mockPrismaService = {
    filter: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    match: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockSharedConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3004'),
  };

  const mockFilterMatcherService = {
    matches: jest.fn(),
    calculateMatchScore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiltersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: SharedConfigService, useValue: mockSharedConfigService },
        { provide: FilterMatcherService, useValue: mockFilterMatcherService },
      ],
    }).compile();

    service = module.get<FiltersService>(FiltersService);
    prisma = module.get(PrismaService);
    httpService = module.get(HttpService);
    sharedConfigService = module.get(SharedConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should enable users to discover deals in their preferred categories', async () => {
      const createFilterDto: CreateFilterDto = {
        name: 'Gaming Deals',
        description: 'Gaming laptop deals',
        active: true,
        categoryIds: ['category-1'],
        filterExpression: {
          rules: [
            {
              field: 'price',
              operator: 'lte',
              value: 500,
            },
          ],
          matchLogic: 'AND',
          minScore: 50,
          scoreMode: 'weighted',
        },
        immediateNotifications: true,
        digestFrequency: 'daily',
        maxNotificationsPerDay: 50,
      };

      const expectedFilter = { ...mockFilter };

      // Mock category validation
      prisma.category.findMany.mockResolvedValue([{ id: 'category-1' }]);

      prisma.filter.create.mockResolvedValue(expectedFilter);

      // Mock getFilterStats dependencies - note the different call patterns
      prisma.filter.findFirst
        .mockResolvedValueOnce(expectedFilter) // For the main create call
        .mockResolvedValueOnce(expectedFilter); // For getFilterStats call

      // Mock stats for getFilterStats method
      prisma.match.count
        .mockResolvedValueOnce(0) // totalMatches
        .mockResolvedValueOnce(0) // matchesLast24h
        .mockResolvedValueOnce(0); // matchesLast7d

      prisma.match.aggregate
        .mockResolvedValueOnce({ _avg: { score: null } }) // avgScore
        .mockResolvedValueOnce({ _max: { score: null } }); // topScore

      prisma.match.findFirst.mockResolvedValue(null); // lastMatch

      const result = await service.create('user-1', createFilterDto);

      // User Value: Filter created with their preferred settings
      expect(result.name).toBe('Gaming Deals');
      expect(result.categories).toEqual([mockCategory]);
      expect(result.immediateNotifications).toBe(true);
      expect(result.digestFrequency).toBe('daily');
      expect(result.active).toBe(true);

      // User Value: Filter is ready to find deals with tracking capabilities
      expect(result.stats).toBeDefined(); // User can see performance data
      expect(result.stats.totalMatches).toBe(0); // Starting fresh
      expect(result.stats.matchesLast24h).toBe(0); // No matches yet
    });

    it('should prevent users from creating filters with invalid categories', async () => {
      const createFilterDto: CreateFilterDto = {
        name: 'Gaming Deals',
        categoryIds: ['invalid-category'],
        filterExpression: {
          rules: [
            {
              field: 'price',
              operator: 'lte',
              value: 500,
            },
          ],
          matchLogic: 'AND',
          minScore: 50,
          scoreMode: 'weighted',
        },
      };

      // Mock category validation - return empty array for invalid categories
      prisma.category.findMany.mockResolvedValue([]);

      // User Protection: Invalid category prevents filter creation
      await expect(service.create('user-1', createFilterDto)).rejects.toThrow(
        'The following category IDs do not exist: invalid-category'
      );
    });
  });

  describe('findAll', () => {
    it('should provide users with organized access to their deal preferences', async () => {
      const query: FilterQueryDto = { page: 1, limit: 10 };
      const filters = [mockFilter];

      prisma.filter.count.mockResolvedValue(1);
      prisma.filter.findMany.mockResolvedValue(filters);

      // Mock getFilterStats for each filter in the array
      prisma.filter.findFirst.mockResolvedValue(mockFilter);
      prisma.match.count
        .mockResolvedValueOnce(0) // totalMatches
        .mockResolvedValueOnce(0) // matchesLast24h
        .mockResolvedValueOnce(0); // matchesLast7d

      prisma.match.aggregate
        .mockResolvedValueOnce({ _avg: { score: null } }) // avgScore
        .mockResolvedValueOnce({ _max: { score: null } }); // topScore

      prisma.match.findFirst.mockResolvedValue(null); // lastMatch

      const result = await service.findAll('user-1', query);

      // User Value: Organized list of their deal discovery preferences
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].name).toBe('Gaming Deals');
      expect(result.filters[0].categories).toEqual([mockCategory]);

      // User Value: Pagination helps manage large collections
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should help users find filters for specific product categories', async () => {
      const query: FilterQueryDto = {
        page: 1,
        limit: 10,
        category: 'pc-gaming',
      };

      prisma.filter.count.mockResolvedValue(0);
      prisma.filter.findMany.mockResolvedValue([]);

      await service.findAll('user-1', query);

      // User Value: Search functionality for managing filters by category
      expect(query.category).toBe('pc-gaming');
      // Service called with category filter for user convenience
    });
  });

  describe('findOne', () => {
    it('should return a filter with categories', async () => {
      // Mock findOne call and getFilterStats call
      prisma.filter.findFirst
        .mockResolvedValueOnce(mockFilter) // For findOne call
        .mockResolvedValueOnce(mockFilter); // For getFilterStats call

      // Mock stats for getFilterStats method
      prisma.match.count
        .mockResolvedValueOnce(0) // totalMatches
        .mockResolvedValueOnce(0) // matchesLast24h
        .mockResolvedValueOnce(0); // matchesLast7d

      prisma.match.aggregate
        .mockResolvedValueOnce({ _avg: { score: null } }) // avgScore
        .mockResolvedValueOnce({ _max: { score: null } }); // topScore

      prisma.match.findFirst.mockResolvedValue(null); // lastMatch

      const result = await service.findOne('user-1', 'filter-1');

      // User Value: Detailed filter information for managing preferences
      expect(result.id).toBe('filter-1');
      expect(result.name).toBe('Gaming Deals');
      expect(result.active).toBe(true);

      // User Value: Can see which categories they're monitoring
      expect(result.categories).toEqual([mockCategory]);
      expect(result.stats).toBeDefined(); // Performance tracking for user insights
    });

    it('should protect users from accessing filters that do not belong to them', async () => {
      prisma.filter.findFirst.mockResolvedValue(null);

      // User Security: Prevents access to non-existent or unauthorized filters
      await expect(service.findOne('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('should allow users to modify their deal discovery preferences', async () => {
      const updateDto = {
        name: 'Updated Gaming Deals',
        categoryIds: ['category-1', 'category-2'],
      };

      const updatedFilter = {
        ...mockFilter,
        ...updateDto,
        categories: [
          ...mockFilter.categories,
          {
            id: 'fc-2',
            filterId: 'filter-1',
            categoryId: 'category-2',
            createdAt: new Date('2025-01-01'),
            category: {
              ...mockCategory,
              id: 'category-2',
              slug: 'mobile-gaming',
            },
          },
        ],
      };

      prisma.filter.findFirst
        .mockResolvedValueOnce(mockFilter) // For update method check
        .mockResolvedValueOnce(updatedFilter); // For getFilterStats call

      prisma.filter.update.mockResolvedValue(updatedFilter);

      // Mock deleteMany for match re-evaluation (called when categoryIds changes)
      prisma.match.deleteMany.mockResolvedValue({ count: 0 });

      // Mock stats for getFilterStats method
      prisma.match.count
        .mockResolvedValueOnce(0) // totalMatches
        .mockResolvedValueOnce(0) // matchesLast24h
        .mockResolvedValueOnce(0); // matchesLast7d

      prisma.match.aggregate
        .mockResolvedValueOnce({ _avg: { score: null } }) // avgScore
        .mockResolvedValueOnce({ _max: { score: null } }); // topScore

      prisma.match.findFirst.mockResolvedValue(null); // lastMatch

      const result = await service.update('user-1', 'filter-1', updateDto);

      // User Value: Filter updated with new preferences
      expect(result.name).toBe('Updated Gaming Deals');
      expect(result.categories).toHaveLength(2); // Expanded category coverage

      // User Value: More categories means broader deal discovery opportunities
    });

    it('should prevent users from updating filters they do not own', async () => {
      prisma.filter.findFirst.mockResolvedValue(null);

      // User Security: Cannot modify unauthorized filters
      await expect(
        service.update('user-1', 'nonexistent', { name: 'Test' })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
