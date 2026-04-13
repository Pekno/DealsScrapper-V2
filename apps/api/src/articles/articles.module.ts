import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';

const DEFAULT_ELASTICSEARCH_URL = 'http://localhost:9200';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      useFactory: () => {
        const elasticsearchUrl =
          process.env.ELASTICSEARCH_NODE ??
          DEFAULT_ELASTICSEARCH_URL;

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
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
