import { Module, Global } from '@nestjs/common';
import { PuppeteerPoolService } from './puppeteer-pool.service.js';
import { PuppeteerPoolController } from './puppeteer-pool.controller.js';
import { CookieFilterService } from './cookie-filter.service.js';

@Global() // Make it global so it can be used across all modules
@Module({
  providers: [PuppeteerPoolService, CookieFilterService],
  controllers: [PuppeteerPoolController],
  exports: [PuppeteerPoolService, CookieFilterService],
})
export class PuppeteerPoolModule {}
