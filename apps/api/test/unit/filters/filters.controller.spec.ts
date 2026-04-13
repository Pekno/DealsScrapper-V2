import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { FiltersController } from '../../../src/filters/filters.controller';
import { FiltersService } from '../../../src/filters/filters.service';
import { CreateFilterDto } from '../../../src/filters/dto/create-filter.dto';
import { UpdateFilterDto } from '../../../src/filters/dto/update-filter.dto';
import { FilterQueryDto } from '../../../src/filters/dto/filter-query.dto';
import {
  FilterResponseDto,
  FilterListResponseDto,
  MatchListResponseDto,
  FilterStatsDto,
} from '../../../src/filters/dto/filter-response.dto';
import type { AuthenticatedRequest } from '@dealscrapper/shared-types';
import { DigestFrequency } from '@dealscrapper/shared-types/enums';

describe('FiltersController - Filter Management API', () => {
  let controller: FiltersController;
  let filtersService: jest.Mocked<FiltersService>;

  // Mock authenticated request
  const mockAuthenticatedRequest: Partial<AuthenticatedRequest> = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
    },
  };

  // Mock filter response data
  const mockFilterResponse: FilterResponseDto = {
    id: 'filter-1',
    userId: 'user-1',
    name: 'Gaming Deals',
    description: 'Filters for gaming products',
    active: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    categories: [
      {
        id: 'cat-1',
        slug: 'pc-gaming',
        name: 'PC Gaming',
        siteId: 'dealabs',
        sourceUrl: 'https://www.dealabs.com/groupe/pc-gaming',
        level: 1,
        dealCount: 100,
        avgTemperature: 75.5,
        popularBrands: ['NVIDIA', 'AMD'],
        isActive: true,
        userCount: 5,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ],
    enabledSites: ['dealabs'],
    filterExpression: {
      rules: [
        { field: 'currentPrice', operator: '<=', value: 500 },
        { field: 'title', operator: 'CONTAINS', value: 'gaming', caseSensitive: false },
      ],
      matchLogic: 'AND',
    },
    immediateNotifications: true,
    digestFrequency: DigestFrequency.DAILY,
    maxNotificationsPerDay: 50,
    lastMatchAt: new Date('2025-01-15'),
    stats: {
      totalMatches: 25,
      matchesLast24h: 5,
      matchesLast7d: 15,
      avgScore: 75,
      topScore: 95,
      lastMatchAt: new Date('2025-01-15'),
    },
  };

  const mockFilterListResponse: FilterListResponseDto = {
    filters: [mockFilterResponse],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  const mockMatchListResponse: MatchListResponseDto = {
    matches: [
      {
        id: 'match-1',
        filterId: 'filter-1',
        filterName: 'Gaming Deals',
        articleId: 'article-1',
        score: 85,
        notified: true,
        notifiedAt: new Date('2025-01-15'),
        createdAt: new Date('2025-01-15'),
        article: {
          id: 'article-1',
          title: 'RTX 4090 Deal',
          currentPrice: 1200,
          categoryId: 'cat-1',
          siteId: 'dealabs',
          url: 'https://dealabs.com/deals/123',
          scrapedAt: new Date('2025-01-15'),
          isExpired: false,
        },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  const mockFilterStats: FilterStatsDto = {
    totalMatches: 25,
    matchesLast24h: 5,
    matchesLast7d: 15,
    avgScore: 75,
    topScore: 95,
    lastMatchAt: new Date('2025-01-15'),
  };

  const mockFiltersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    toggleActive: jest.fn(),
    getMatches: jest.fn(),
    getFilterStats: jest.fn(),
    getFiltersCount: jest.fn(),
    getScrapingStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FiltersController],
      providers: [
        {
          provide: FiltersService,
          useValue: mockFiltersService,
        },
      ],
    }).compile();

    // Suppress logger output during tests
    module.useLogger(false);

    controller = module.get<FiltersController>(FiltersController);
    filtersService = module.get(FiltersService);
  });

  describe('create', () => {
    it('should create a new filter and return success response', async () => {
      // Arrange
      const createFilterDto: CreateFilterDto = {
        name: 'Gaming Deals',
        description: 'Filters for gaming products',
        categoryIds: ['cat-1'],
        filterExpression: {
          rules: [{ field: 'currentPrice', operator: '<=', value: 500 }],
          matchLogic: 'AND',
        },
      };
      mockFiltersService.create.mockResolvedValue(mockFilterResponse);

      // Act
      const result = await controller.create(
        mockAuthenticatedRequest as AuthenticatedRequest,
        createFilterDto,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter created successfully');
      expect(result.data.id).toBe('filter-1');
      expect(result.data.name).toBe('Gaming Deals');
      expect(mockFiltersService.create).toHaveBeenCalledWith('user-1', createFilterDto);
    });

    it('should propagate service errors', async () => {
      // Arrange
      const createFilterDto: CreateFilterDto = {
        name: 'Test Filter',
        categoryIds: ['invalid-cat'],
        filterExpression: {
          rules: [{ field: 'title', operator: 'CONTAINS', value: 'test' }],
          matchLogic: 'AND',
        },
      };
      mockFiltersService.create.mockRejectedValue(new Error('Category not found'));

      // Act & Assert
      await expect(
        controller.create(mockAuthenticatedRequest as AuthenticatedRequest, createFilterDto),
      ).rejects.toThrow('Category not found');
    });
  });

  describe('findAll', () => {
    it('should return all filters for the authenticated user', async () => {
      // Arrange
      const query: FilterQueryDto = { page: 1, limit: 20 };
      mockFiltersService.findAll.mockResolvedValue(mockFilterListResponse);

      // Act
      const result = await controller.findAll(
        mockAuthenticatedRequest as AuthenticatedRequest,
        query,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filters retrieved successfully');
      expect(result.data.filters).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(mockFiltersService.findAll).toHaveBeenCalledWith('user-1', query);
    });

    it('should pass query parameters to service', async () => {
      // Arrange
      const query: FilterQueryDto = {
        page: 2,
        limit: 10,
        active: true,
        search: 'gaming',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      mockFiltersService.findAll.mockResolvedValue(mockFilterListResponse);

      // Act
      await controller.findAll(mockAuthenticatedRequest as AuthenticatedRequest, query);

      // Assert
      expect(mockFiltersService.findAll).toHaveBeenCalledWith('user-1', query);
    });
  });

  describe('getFiltersCount', () => {
    it('should return total filter count for user', async () => {
      // Arrange
      mockFiltersService.getFiltersCount.mockResolvedValue(6);

      // Act
      const result = await controller.getFiltersCount(
        mockAuthenticatedRequest as AuthenticatedRequest,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter count retrieved successfully');
      expect(result.data).toBe(6);
      expect(mockFiltersService.getFiltersCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findOne', () => {
    it('should return a specific filter by ID', async () => {
      // Arrange
      mockFiltersService.findOne.mockResolvedValue(mockFilterResponse);

      // Act
      const result = await controller.findOne(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter retrieved successfully');
      expect(result.data.id).toBe('filter-1');
      expect(mockFiltersService.findOne).toHaveBeenCalledWith('user-1', 'filter-1');
    });

    it('should propagate NotFoundException', async () => {
      // Arrange
      mockFiltersService.findOne.mockRejectedValue(
        new NotFoundException('Filter with ID nonexistent not found'),
      );

      // Act & Assert
      await expect(
        controller.findOne(mockAuthenticatedRequest as AuthenticatedRequest, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a filter and return success response', async () => {
      // Arrange
      const updateFilterDto: UpdateFilterDto = {
        name: 'Updated Gaming Deals',
        active: false,
      };
      const updatedFilter = { ...mockFilterResponse, name: 'Updated Gaming Deals', active: false };
      mockFiltersService.update.mockResolvedValue(updatedFilter);

      // Act
      const result = await controller.update(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
        updateFilterDto,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter updated successfully');
      expect(result.data.name).toBe('Updated Gaming Deals');
      expect(mockFiltersService.update).toHaveBeenCalledWith('user-1', 'filter-1', updateFilterDto);
    });

    it('should propagate NotFoundException', async () => {
      // Arrange
      mockFiltersService.update.mockRejectedValue(
        new NotFoundException('Filter not found'),
      );

      // Act & Assert
      await expect(
        controller.update(
          mockAuthenticatedRequest as AuthenticatedRequest,
          'nonexistent',
          { name: 'Test' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a filter and return success response', async () => {
      // Arrange
      mockFiltersService.remove.mockResolvedValue(undefined);

      // Act
      const result = await controller.remove(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter deleted successfully');
      expect(result.data).toBeNull();
      expect(mockFiltersService.remove).toHaveBeenCalledWith('user-1', 'filter-1');
    });

    it('should propagate NotFoundException', async () => {
      // Arrange
      mockFiltersService.remove.mockRejectedValue(
        new NotFoundException('Filter not found'),
      );

      // Act & Assert
      await expect(
        controller.remove(mockAuthenticatedRequest as AuthenticatedRequest, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle filter active status', async () => {
      // Arrange
      const toggledFilter = { ...mockFilterResponse, active: false };
      mockFiltersService.toggleActive.mockResolvedValue(toggledFilter);

      // Act
      const result = await controller.toggleActive(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter status toggled successfully');
      expect(result.data.active).toBe(false);
      expect(mockFiltersService.toggleActive).toHaveBeenCalledWith('user-1', 'filter-1');
    });
  });

  describe('getMatches', () => {
    it('should return filter matches with pagination', async () => {
      // Arrange
      mockFiltersService.getMatches.mockResolvedValue(mockMatchListResponse);

      // Act
      const result = await controller.getMatches(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
        '1',
        '20',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Matches retrieved successfully');
      expect(result.data.matches).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(mockFiltersService.getMatches).toHaveBeenCalledWith(
        'user-1',
        'filter-1',
        1,
        20,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should pass search and sort parameters', async () => {
      // Arrange
      mockFiltersService.getMatches.mockResolvedValue(mockMatchListResponse);

      // Act
      await controller.getMatches(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
        '1',
        '20',
        'gaming',
        'score',
        'desc',
      );

      // Assert
      expect(mockFiltersService.getMatches).toHaveBeenCalledWith(
        'user-1',
        'filter-1',
        1,
        20,
        'gaming',
        'score',
        'desc',
      );
    });
  });

  describe('getStats', () => {
    it('should return filter statistics', async () => {
      // Arrange
      mockFiltersService.getFilterStats.mockResolvedValue(mockFilterStats);

      // Act
      const result = await controller.getStats(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Filter statistics retrieved successfully');
      expect(result.data.totalMatches).toBe(25);
      expect(result.data.matchesLast24h).toBe(5);
      expect(result.data.avgScore).toBe(75);
      expect(mockFiltersService.getFilterStats).toHaveBeenCalledWith('user-1', 'filter-1');
    });
  });

  describe('getScrapingStatus', () => {
    it('should return scraping job status for filter categories', async () => {
      // Arrange
      const mockScrapingStatus = {
        categories: [
          {
            categoryId: 'cat-1',
            categoryName: 'PC Gaming',
            scheduledJob: {
              id: 'job-1',
              nextScheduledAt: new Date('2025-01-16T10:00:00Z'),
              isActive: true,
            },
            latestExecution: {
              id: 'exec-1',
              status: 'completed',
              createdAt: new Date('2025-01-15T10:00:00Z'),
              updatedAt: new Date('2025-01-15T10:05:00Z'),
              executionTimeMs: 30000,
              dealsFound: 50,
              dealsProcessed: 48,
            },
          },
        ],
        nextScrapingAt: new Date('2025-01-16T10:00:00Z'),
      };
      mockFiltersService.getScrapingStatus.mockResolvedValue(mockScrapingStatus);

      // Act
      const result = await controller.getScrapingStatus(
        mockAuthenticatedRequest as AuthenticatedRequest,
        'filter-1',
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Scraping status retrieved successfully');
      expect(result.data.categories).toHaveLength(1);
      expect(result.data.categories[0].categoryName).toBe('PC Gaming');
      expect(result.data.nextScrapingAt).toBeDefined();
      expect(mockFiltersService.getScrapingStatus).toHaveBeenCalledWith('user-1', 'filter-1');
    });
  });
});
