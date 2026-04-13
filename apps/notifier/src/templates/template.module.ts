import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplateService } from './template.service.js';

@Module({
  imports: [ConfigModule],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
