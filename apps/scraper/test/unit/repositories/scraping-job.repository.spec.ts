import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@dealscrapper/database';
import { ScrapingJobRepository } from '../../../src/repositories/scraping-job.repository.js';

describe('ScrapingJobRepository', () => {
  let repository: ScrapingJobRepository;
  let prismaService: PrismaService;

  const mockPrismaService = {
    scheduledJob: {
      findUnique: jest.fn(),
    },
    scrapingJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapingJobRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<ScrapingJobRepository>(ScrapingJobRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProcessingJob', () => {
    const scheduledJobId = 'test-scheduled-job-id';
    const metadata = { testKey: 'testValue' };

    it('should create ScrapingJob when ScheduledJob exists', async () => {
      // Arrange
      const expectedScrapingJob = {
        id: 'test-scraping-job-id',
        scheduledJobId,
        status: 'processing',
        attempts: 1,
        metadata,
      };

      mockPrismaService.scheduledJob.findUnique.mockResolvedValue({
        id: scheduledJobId,
      });
      mockPrismaService.scrapingJob.create.mockResolvedValue(
        expectedScrapingJob
      );

      // Act
      const result = await repository.createProcessingJob(
        scheduledJobId,
        metadata
      );

      // Assert
      expect(mockPrismaService.scheduledJob.findUnique).toHaveBeenCalledWith({
        where: { id: scheduledJobId },
      });
      expect(mockPrismaService.scrapingJob.create).toHaveBeenCalledWith({
        data: {
          scheduledJob: {
            connect: {
              id: scheduledJobId,
            },
          },
          status: 'processing',
          attempts: 1,
          lastAttempt: expect.any(Date),
          metadata,
        },
        include: {
          scheduledJob: {
            include: {
              category: true,
            },
          },
        },
      });
      expect(result).toEqual(expectedScrapingJob);
    });

    it('should throw error when ScheduledJob does not exist', async () => {
      // Arrange
      mockPrismaService.scheduledJob.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        repository.createProcessingJob(scheduledJobId, metadata)
      ).rejects.toThrow(
        `ScheduledJob with ID ${scheduledJobId} not found. Cannot create ScrapingJob for non-existent ScheduledJob.`
      );

      expect(mockPrismaService.scheduledJob.findUnique).toHaveBeenCalledWith({
        where: { id: scheduledJobId },
      });
      expect(mockPrismaService.scrapingJob.create).not.toHaveBeenCalled();
    });

    it('should handle undefined metadata gracefully', async () => {
      // Arrange
      const expectedScrapingJob = {
        id: 'test-scraping-job-id',
        scheduledJobId,
        status: 'processing',
        attempts: 1,
        metadata: undefined,
      };

      mockPrismaService.scheduledJob.findUnique.mockResolvedValue({
        id: scheduledJobId,
      });
      mockPrismaService.scrapingJob.create.mockResolvedValue(
        expectedScrapingJob
      );

      // Act
      const result = await repository.createProcessingJob(scheduledJobId);

      // Assert
      expect(mockPrismaService.scrapingJob.create).toHaveBeenCalledWith({
        data: {
          scheduledJob: {
            connect: {
              id: scheduledJobId,
            },
          },
          status: 'processing',
          attempts: 1,
          lastAttempt: expect.any(Date),
          metadata: undefined,
        },
        include: {
          scheduledJob: {
            include: {
              category: true,
            },
          },
        },
      });
      expect(result).toEqual(expectedScrapingJob);
    });
  });
});
