import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { Redis } from 'ioredis';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
import { SIMILAR_CACHE_REDIS_CLIENT } from './articles.constants.js';

const DEFAULT_ELASTICSEARCH_URL = 'http://localhost:9200';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      useFactory: () => {
        const elasticsearchUrl =
          process.env.ELASTICSEARCH_NODE ?? DEFAULT_ELASTICSEARCH_URL;

        return {
          node: elasticsearchUrl,
          maxRetries: 3,
          requestTimeout: 30000,
          pingTimeout: 30000,
          compression: true,
          keepAlive: true,
          ssl: {
            rejectUnauthorized: false,
          },
        };
      },
    }),
  ],
  controllers: [ArticlesController],
  providers: [
    ArticlesService,
    {
      // Reuse the same ioredis connection settings BullMQ already uses
      // (SharedConfigService.getRedisConfig), mirroring the notifier's
      // 'REDIS_CLIENT' provider pattern. No new dependency: ioredis is a
      // transitive dep of bull.
      provide: SIMILAR_CACHE_REDIS_CLIENT,
      useFactory: (sharedConfig: SharedConfigService): Redis =>
        new Redis(sharedConfig.getRedisConfig()),
      inject: [SharedConfigService],
    },
  ],
  exports: [ArticlesService],
})
export class ArticlesModule {}
