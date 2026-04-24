import { Test, TestingModule } from '@nestjs/testing';
import { HtmlToMarkdownService } from '../html-to-markdown.service.js';

describe('HtmlToMarkdownService', () => {
  let service: HtmlToMarkdownService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HtmlToMarkdownService],
    }).compile();
    service = module.get(HtmlToMarkdownService);
  });

  const sourceUrl = 'https://www.dealabs.com/deals/123';

  it('strips script and style tags', () => {
    // Arrange
    const html = `<div><script>alert(1)</script><style>.x{color:red}</style><p>Deal title</p></div>`;

    // Act
    const md = service.prepare(html, sourceUrl);

    // Assert
    expect(md).not.toContain('alert');
    expect(md).not.toContain('color:red');
    expect(md).toContain('Deal title');
  });

  it('strips svg and noscript elements', () => {
    const html = `<div><svg><path d="M0"/></svg><noscript>Enable JS</noscript><h1>Price</h1></div>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).not.toContain('path');
    expect(md).not.toContain('Enable JS');
    expect(md).toContain('Price');
  });

  it('strips on* event attributes', () => {
    const html = `<button onclick="steal()" onmouseover="track()">Click</button>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).not.toContain('onclick');
    expect(md).not.toContain('onmouseover');
  });

  it('strips base64 src attributes', () => {
    const html = `<img src="data:image/png;base64,abc123" alt="product"/>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).not.toContain('data:image');
  });

  it('strips tracking data attributes', () => {
    const html = `<a href="/deal" data-analytics="click" data-track="btn">Deal</a>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).not.toContain('data-analytics');
    expect(md).not.toContain('data-track');
    expect(md).toContain('Deal');
  });

  it('resolves relative URLs to absolute', () => {
    const html = `<a href="/deals/456">View Deal</a>`;
    const md = service.prepare(html, 'https://www.dealabs.com/deals/123');
    expect(md).toContain('https://www.dealabs.com/deals/456');
  });

  it('preserves absolute URLs unchanged', () => {
    const html = `<a href="https://amazon.fr/product">Amazon</a>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).toContain('https://amazon.fr/product');
  });

  it('preserves heading structure', () => {
    const html = `<h1>Main Title</h1><h2>Sub Title</h2><p>Body text</p>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).toContain('# Main Title');
    expect(md).toContain('## Sub Title');
    expect(md).toContain('Body text');
  });

  it('caps output at 3500 characters', () => {
    const longContent = '<p>' + 'A'.repeat(10000) + '</p>';
    const md = service.prepare(longContent, sourceUrl);
    expect(md.length).toBeLessThanOrEqual(3500);
  });

  it('keeps alt and title on images', () => {
    const html = `<img src="https://img.example.com/deal.jpg" alt="Nintendo Switch" title="Best deal"/>`;
    const md = service.prepare(html, sourceUrl);
    expect(md).toContain('Nintendo Switch');
    expect(md).toContain('Best deal');
  });
});
