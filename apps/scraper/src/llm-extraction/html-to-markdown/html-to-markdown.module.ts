import { Module } from '@nestjs/common';
import { HtmlToMarkdownService } from './html-to-markdown.service.js';

@Module({
  providers: [HtmlToMarkdownService],
  exports: [HtmlToMarkdownService],
})
export class HtmlToMarkdownModule {}
