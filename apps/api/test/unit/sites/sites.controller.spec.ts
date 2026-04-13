import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SitesController } from '../../../src/sites/sites.controller';
import { SitesService } from '../../../src/sites/sites.service';
import { SiteResponseDto } from '../../../src/sites/dto/site.dto';

describe('SitesController - Sites API', () => {
  let controller: SitesController;
  let sitesService: jest.Mocked<SitesService>;

  // Mock site response data
  const mockDealabsSiteResponse: SiteResponseDto = {
    id: 'dealabs',
    name: 'Dealabs',
    color: '#FF6B00',
    isActive: true,
    iconUrl: 'https://example.com/dealabs-icon.png',
  };

  const mockVintedSiteResponse: SiteResponseDto = {
    id: 'vinted',
    name: 'Vinted',
    color: '#09B1BA',
    isActive: true,
    iconUrl: 'https://example.com/vinted-icon.png',
  };

  const mockLeBonCoinSiteResponse: SiteResponseDto = {
    id: 'leboncoin',
    name: 'LeBonCoin',
    color: '#FF6B00',
    isActive: true,
    iconUrl: 'https://example.com/leboncoin-icon.png',
  };

  const mockSitesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findAllIncludingInactive: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SitesController],
      providers: [
        {
          provide: SitesService,
          useValue: mockSitesService,
        },
      ],
    }).compile();

    controller = module.get<SitesController>(SitesController);
    sitesService = module.get(SitesService);
  });

  describe('findAll', () => {
    it('should return all active sites', async () => {
      // Arrange
      mockSitesService.findAll.mockResolvedValue([
        mockDealabsSiteResponse,
        mockVintedSiteResponse,
        mockLeBonCoinSiteResponse,
      ]);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result.sites).toHaveLength(3);
      expect(result.sites[0].id).toBe('dealabs');
      expect(result.sites[1].id).toBe('vinted');
      expect(result.sites[2].id).toBe('leboncoin');
      expect(mockSitesService.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no sites exist', async () => {
      // Arrange
      mockSitesService.findAll.mockResolvedValue([]);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result.sites).toHaveLength(0);
    });

    it('should include site metadata for frontend display', async () => {
      // Arrange
      mockSitesService.findAll.mockResolvedValue([mockDealabsSiteResponse]);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result.sites[0]).toEqual({
        id: 'dealabs',
        name: 'Dealabs',
        color: '#FF6B00',
        isActive: true,
        iconUrl: 'https://example.com/dealabs-icon.png',
      });
    });
  });

  describe('findOne', () => {
    it('should return a specific site by ID', async () => {
      // Arrange
      mockSitesService.findOne.mockResolvedValue(mockDealabsSiteResponse);

      // Act
      const result = await controller.findOne('dealabs');

      // Assert
      expect(result.id).toBe('dealabs');
      expect(result.name).toBe('Dealabs');
      expect(result.color).toBe('#FF6B00');
      expect(mockSitesService.findOne).toHaveBeenCalledWith('dealabs');
    });

    it('should return site with all fields', async () => {
      // Arrange
      mockSitesService.findOne.mockResolvedValue(mockVintedSiteResponse);

      // Act
      const result = await controller.findOne('vinted');

      // Assert
      expect(result).toEqual({
        id: 'vinted',
        name: 'Vinted',
        color: '#09B1BA',
        isActive: true,
        iconUrl: 'https://example.com/vinted-icon.png',
      });
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      mockSitesService.findOne.mockRejectedValue(
        new NotFoundException("Site with ID 'nonexistent' not found"),
      );

      // Act & Assert
      await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should handle inactive site error from service', async () => {
      // Arrange
      mockSitesService.findOne.mockRejectedValue(
        new NotFoundException("Site with ID 'inactive-site' is not active"),
      );

      // Act & Assert
      await expect(controller.findOne('inactive-site')).rejects.toThrow(NotFoundException);
    });
  });
});
