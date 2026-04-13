import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from '../../../src/categories/categories.controller';
import { CategoriesService } from '../../../src/categories/categories.service';
import { CategoryDto } from '../../../src/categories/dto/category.dto';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: jest.Mocked<CategoriesService>;

  const mockCategories: CategoryDto[] = [
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
    },
  ];

  const mockCategoriesService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get(CategoriesService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all categories when no search parameter is provided', async () => {
      service.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Categories retrieved successfully');
      expect(result.data).toEqual(mockCategories);
      expect(result.data).toHaveLength(2);
    });

    it('should return filtered categories when search parameter is provided', async () => {
      const searchTerm = 'gaming';
      const filteredCategories = mockCategories.filter((cat) =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      service.findAll.mockResolvedValue(filteredCategories);

      const result = await controller.findAll(searchTerm);

      expect(service.findAll).toHaveBeenCalledWith(searchTerm, undefined);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Categories retrieved successfully');
      expect(result.data).toEqual(filteredCategories);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array when no categories match search term', async () => {
      const searchTerm = 'nonexistent';
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(searchTerm);

      expect(service.findAll).toHaveBeenCalledWith(searchTerm, undefined);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Categories retrieved successfully');
      expect(result.data).toEqual([]);
      expect(result.data).toHaveLength(0);
    });

    it('should handle empty search parameter', async () => {
      const searchTerm = '';
      service.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll(searchTerm);

      expect(service.findAll).toHaveBeenCalledWith(searchTerm, undefined);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Categories retrieved successfully');
      expect(result.data).toEqual(mockCategories);
    });

    it('should filter categories by source when source parameter is provided', async () => {
      const dealabsCategories = mockCategories.filter(
        (cat) => cat.siteId === 'dealabs'
      );
      service.findAll.mockResolvedValue(dealabsCategories);

      const result = await controller.findAll(undefined, 'dealabs');

      expect(service.findAll).toHaveBeenCalledWith(undefined, ['dealabs']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(dealabsCategories);
    });

    it('should filter categories by multiple sources', async () => {
      service.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll(undefined, 'dealabs,vinted');

      expect(service.findAll).toHaveBeenCalledWith(undefined, [
        'dealabs',
        'vinted',
      ]);
      expect(result.success).toBe(true);
    });

    it('should combine search and source filters', async () => {
      const searchTerm = 'gaming';
      const source = 'dealabs';
      service.findAll.mockResolvedValue([mockCategories[0]]);

      const result = await controller.findAll(searchTerm, source);

      expect(service.findAll).toHaveBeenCalledWith(searchTerm, ['dealabs']);
      expect(result.success).toBe(true);
    });
  });
});
