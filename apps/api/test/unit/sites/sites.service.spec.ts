import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import type { Site } from '@dealscrapper/database';
import { SitesService } from '../../../src/sites/sites.service';

describe('SitesService - Site Data Retrieval', () => {
  let service: SitesService;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock site data
  const mockDealabsSite: Site = {
    id: 'dealabs',
    name: 'Dealabs',
    baseUrl: 'https://www.dealabs.com',
    categoryDiscoveryUrl: 'https://www.dealabs.com/groupe/',
    color: '#FF6B00',
    isActive: true,
    iconUrl: 'https://example.com/dealabs-icon.png',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockVintedSite: Site = {
    id: 'vinted',
    name: 'Vinted',
    baseUrl: 'https://www.vinted.fr',
    categoryDiscoveryUrl: 'https://www.vinted.fr/catalog',
    color: '#09B1BA',
    isActive: true,
    iconUrl: 'https://example.com/vinted-icon.png',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockLeBonCoinSite: Site = {
    id: 'leboncoin',
    name: 'LeBonCoin',
    baseUrl: 'https://www.leboncoin.fr',
    categoryDiscoveryUrl: 'https://www.leboncoin.fr/categories',
    color: '#FF6B00',
    isActive: false, // Inactive for testing
    iconUrl: 'https://example.com/leboncoin-icon.png',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockPrismaService = {
    site: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    // Suppress logger output during tests
    module.useLogger(false);

    service = module.get<SitesService>(SitesService);
    prismaService = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('should return all active sites', async () => {
      // Arrange
      mockPrismaService.site.findMany.mockResolvedValue([mockDealabsSite, mockVintedSite]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('dealabs');
      expect(result[0].name).toBe('Dealabs');
      expect(result[0].color).toBe('#FF6B00');
      expect(result[0].isActive).toBe(true);
      expect(result[1].id).toBe('vinted');
      expect(mockPrismaService.site.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no active sites exist', async () => {
      // Arrange
      mockPrismaService.site.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should map site to response DTO correctly', async () => {
      // Arrange
      mockPrismaService.site.findMany.mockResolvedValue([mockDealabsSite]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result[0]).toEqual({
        id: 'dealabs',
        name: 'Dealabs',
        color: '#FF6B00',
        isActive: true,
        iconUrl: 'https://example.com/dealabs-icon.png',
      });
    });

    it('should handle null iconUrl', async () => {
      // Arrange
      const siteWithoutIcon: Site = {
        ...mockDealabsSite,
        iconUrl: null,
      };
      mockPrismaService.site.findMany.mockResolvedValue([siteWithoutIcon]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result[0].iconUrl).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return a specific site by ID', async () => {
      // Arrange
      mockPrismaService.site.findUnique.mockResolvedValue(mockDealabsSite);

      // Act
      const result = await service.findOne('dealabs');

      // Assert
      expect(result.id).toBe('dealabs');
      expect(result.name).toBe('Dealabs');
      expect(result.color).toBe('#FF6B00');
      expect(mockPrismaService.site.findUnique).toHaveBeenCalledWith({
        where: { id: 'dealabs' },
      });
    });

    it('should throw NotFoundException when site not found', async () => {
      // Arrange
      mockPrismaService.site.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        "Site with ID 'nonexistent' not found",
      );
    });

    it('should throw NotFoundException when site is inactive', async () => {
      // Arrange
      mockPrismaService.site.findUnique.mockResolvedValue(mockLeBonCoinSite);

      // Act & Assert
      await expect(service.findOne('leboncoin')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('leboncoin')).rejects.toThrow(
        "Site with ID 'leboncoin' is not active",
      );
    });
  });

  describe('findAllIncludingInactive', () => {
    it('should return all sites including inactive ones', async () => {
      // Arrange
      mockPrismaService.site.findMany.mockResolvedValue([
        mockDealabsSite,
        mockVintedSite,
        mockLeBonCoinSite,
      ]);

      // Act
      const result = await service.findAllIncludingInactive();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.some((s) => s.id === 'leboncoin' && !s.isActive)).toBe(true);
      expect(mockPrismaService.site.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });
});
