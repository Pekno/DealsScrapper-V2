import { Test, TestingModule } from '@nestjs/testing';
import { AdapterRegistry } from '../adapter.registry';
import { DealabsAdapter } from '../dealabs/dealabs.adapter';
import { VintedAdapter } from '../vinted/vinted.adapter';
import { LeBonCoinAdapter } from '../leboncoin/leboncoin.adapter';
import { DealabsUrlOptimizer } from '../dealabs/dealabs-url-optimizer';
import { FieldExtractorService } from '../../field-extraction/field-extractor.service';
import { SiteSource } from '@dealscrapper/shared-types';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdapterRegistry,
        DealabsAdapter,
        VintedAdapter,
        LeBonCoinAdapter,
        DealabsUrlOptimizer,
        FieldExtractorService,
      ],
    }).compile();

    registry = module.get<AdapterRegistry>(AdapterRegistry);
  });

  it('should be defined', () => {
    expect(registry).toBeDefined();
  });

  describe('getAdapter()', () => {
    it('should return Dealabs adapter', () => {
      const adapter = registry.getAdapter(SiteSource.DEALABS);

      expect(adapter).toBeDefined();
      expect(adapter.siteId).toBe(SiteSource.DEALABS);
      expect(adapter.displayName).toBe('Dealabs');
    });

    it('should return Vinted adapter', () => {
      const adapter = registry.getAdapter(SiteSource.VINTED);

      expect(adapter).toBeDefined();
      expect(adapter.siteId).toBe(SiteSource.VINTED);
      expect(adapter.displayName).toBe('Vinted');
    });

    it('should return LeBonCoin adapter', () => {
      const adapter = registry.getAdapter(SiteSource.LEBONCOIN);

      expect(adapter).toBeDefined();
      expect(adapter.siteId).toBe(SiteSource.LEBONCOIN);
      expect(adapter.displayName).toBe('LeBonCoin');
    });

    it('should throw error for unknown site', () => {
      expect(() => {
        registry.getAdapter('unknown' as SiteSource);
      }).toThrow('No adapter registered');
    });
  });

  describe('getAllAdapters()', () => {
    it('should return all adapters', () => {
      const adapters = registry.getAllAdapters();

      expect(adapters).toHaveLength(3);
      expect(adapters.map((a) => a.siteId)).toEqual(
        expect.arrayContaining([
          SiteSource.DEALABS,
          SiteSource.VINTED,
          SiteSource.LEBONCOIN,
        ]),
      );
    });
  });

  describe('getAllSiteIds()', () => {
    it('should return all site IDs', () => {
      const siteIds = registry.getAllSiteIds();

      expect(siteIds).toHaveLength(3);
      expect(siteIds).toEqual(
        expect.arrayContaining([
          SiteSource.DEALABS,
          SiteSource.VINTED,
          SiteSource.LEBONCOIN,
        ]),
      );
    });
  });

  describe('hasAdapter()', () => {
    it('should return true for registered sites', () => {
      expect(registry.hasAdapter(SiteSource.DEALABS)).toBe(true);
      expect(registry.hasAdapter(SiteSource.VINTED)).toBe(true);
      expect(registry.hasAdapter(SiteSource.LEBONCOIN)).toBe(true);
    });

    it('should return false for unregistered sites', () => {
      expect(registry.hasAdapter('unknown' as SiteSource)).toBe(false);
    });
  });

  describe('getSiteMetadata()', () => {
    it('should return metadata for all sites', () => {
      const metadata = registry.getSiteMetadata();

      expect(metadata).toHaveLength(3);

      const dealabsMetadata = metadata.find((m) => m.id === SiteSource.DEALABS);
      expect(dealabsMetadata).toEqual({
        id: SiteSource.DEALABS,
        name: 'Dealabs',
        color: '#FF6B35',
        baseUrl: 'https://www.dealabs.com',
        supportsUrlOptimization: true,
      });

      const vintedMetadata = metadata.find((m) => m.id === SiteSource.VINTED);
      expect(vintedMetadata).toEqual({
        id: SiteSource.VINTED,
        name: 'Vinted',
        color: '#09B1BA',
        baseUrl: 'https://www.vinted.fr',
        supportsUrlOptimization: false,
      });

      const leboncoinMetadata = metadata.find((m) => m.id === SiteSource.LEBONCOIN);
      expect(leboncoinMetadata).toEqual({
        id: SiteSource.LEBONCOIN,
        name: 'LeBonCoin',
        color: '#FF6E14',
        baseUrl: 'https://www.leboncoin.fr',
        supportsUrlOptimization: false,
      });
    });
  });

  describe('getSiteMetadataById()', () => {
    it('should return metadata for specific site', () => {
      const metadata = registry.getSiteMetadataById(SiteSource.DEALABS);

      expect(metadata).toEqual({
        id: SiteSource.DEALABS,
        name: 'Dealabs',
        color: '#FF6B35',
        baseUrl: 'https://www.dealabs.com',
        supportsUrlOptimization: true,
      });
    });

    it('should throw error for unknown site', () => {
      expect(() => {
        registry.getSiteMetadataById('unknown' as SiteSource);
      }).toThrow('No adapter registered');
    });
  });
});
