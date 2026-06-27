import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@dealscrapper/database';
import { ArticleRepository } from '../../../src/repositories/article.repository';

/**
 * Regression coverage for the site-scoping fix: externalId is only unique per
 * site (@@unique([siteId, externalId])), so existence/lookup queries MUST be
 * scoped by siteId. The same externalId under two different sites must resolve
 * to two DISTINCT rows.
 */
describe('ArticleRepository - site-scoped externalId lookups', () => {
  let repository: ArticleRepository;
  let mockArticle: {
    findUnique: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };

  beforeEach(async () => {
    mockArticle = {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleRepository,
        {
          provide: PrismaService,
          useValue: { article: mockArticle },
        },
      ],
    }).compile();

    repository = module.get<ArticleRepository>(ArticleRepository);
  });

  it('findByExternalId resolves the same externalId on two sites to distinct rows', async () => {
    // Arrange
    const externalId = 'shared-123';
    const dealabsRow = { id: 'a1', externalId, siteId: 'dealabs' };
    const vintedRow = { id: 'a2', externalId, siteId: 'vinted' };
    mockArticle.findUnique
      .mockResolvedValueOnce(dealabsRow)
      .mockResolvedValueOnce(vintedRow);

    // Act
    const fromDealabs = await repository.findByExternalId(externalId, 'dealabs');
    const fromVinted = await repository.findByExternalId(externalId, 'vinted');

    // Assert
    expect(fromDealabs).toBe(dealabsRow);
    expect(fromVinted).toBe(vintedRow);
    expect(mockArticle.findUnique).toHaveBeenNthCalledWith(1, {
      where: { siteId_externalId: { siteId: 'dealabs', externalId } },
    });
    expect(mockArticle.findUnique).toHaveBeenNthCalledWith(2, {
      where: { siteId_externalId: { siteId: 'vinted', externalId } },
    });
  });

  it('existsByExternalId scopes the existence check to the given site', async () => {
    // Arrange
    const externalId = 'shared-123';
    mockArticle.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    // Act
    const existsOnDealabs = await repository.existsByExternalId(
      externalId,
      'dealabs'
    );
    const existsOnVinted = await repository.existsByExternalId(
      externalId,
      'vinted'
    );

    // Assert: same externalId reports per-site existence independently
    expect(existsOnDealabs).toBe(true);
    expect(existsOnVinted).toBe(false);
    expect(mockArticle.count).toHaveBeenNthCalledWith(1, {
      where: { siteId: 'dealabs', externalId },
    });
    expect(mockArticle.count).toHaveBeenNthCalledWith(2, {
      where: { siteId: 'vinted', externalId },
    });
  });

  it('checkExistenceByExternalIds scopes the batch query to the given site', async () => {
    // Arrange
    const externalIds = ['shared-123', 'only-vinted'];
    mockArticle.findMany.mockResolvedValue([
      { externalId: 'shared-123', siteId: 'dealabs' },
    ]);

    // Act
    const existenceMap = await repository.checkExistenceByExternalIds(
      externalIds,
      'dealabs'
    );

    // Assert
    expect(mockArticle.findMany).toHaveBeenCalledWith({
      where: { siteId: 'dealabs', externalId: { in: externalIds } },
    });
    expect(existenceMap.get('shared-123')).toBe(true);
    expect(existenceMap.get('only-vinted')).toBe(false);
  });
});
