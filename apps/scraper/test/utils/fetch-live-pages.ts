import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface PageToFetch {
  name: string;
  url: string;
  description: string;
}

const PAGES_TO_FETCH: PageToFetch[] = [
  {
    name: 'smartphones-listing',
    url: 'https://www.dealabs.com/groupe/smartphones',
    description: 'Smartphones category listing page with deals',
  },
  {
    name: 'laptops-listing',
    url: 'https://www.dealabs.com/groupe/ordinateurs-portables',
    description: 'Laptops category listing page with deals',
  },
  {
    name: 'gaming-listing',
    url: 'https://www.dealabs.com/groupe/jeux-video',
    description: 'Gaming category listing page with deals',
  },
  {
    name: 'home-garden-listing',
    url: 'https://www.dealabs.com/groupe/maison-jardin',
    description: 'Home & Garden category listing page with deals',
  },
  {
    name: 'main-homepage',
    url: 'https://www.dealabs.com/',
    description: 'Main homepage with featured deals',
  },
  {
    name: 'hot-deals',
    url: 'https://www.dealabs.com/nouveaux',
    description: 'New/Hot deals page',
  },
];

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'html');
const METADATA_FILE = path.join(FIXTURES_DIR, 'pages-metadata.json');

interface PageMetadata {
  name: string;
  url: string;
  description: string;
  fetchedAt: string;
  size: number;
  dealCount?: number;
  categoryCount?: number;
}

class LivePageFetcher {
  private browser: puppeteer.Browser | null = null;

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Puppeteer...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
      ],
    });
  }

  async fetchPage(pageInfo: PageToFetch): Promise<PageMetadata> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    console.log(`📄 Fetching: ${pageInfo.name} from ${pageInfo.url}`);

    const page = await this.browser.newPage();

    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to page
      await page.goto(pageInfo.url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get page content
      const html = await page.content();

      // Analyze page content
      const dealCount = await page.$$eval(
        '[data-t*="deal"], .deal, .thread-link',
        (elements) => elements.length
      );
      const categoryCount = await page.$$eval(
        '[data-t*="category"], .category, .group-link',
        (elements) => elements.length
      );

      // Save HTML file
      const filePath = path.join(FIXTURES_DIR, `${pageInfo.name}.html`);
      fs.writeFileSync(filePath, html, 'utf-8');

      const metadata: PageMetadata = {
        name: pageInfo.name,
        url: pageInfo.url,
        description: pageInfo.description,
        fetchedAt: new Date().toISOString(),
        size: html.length,
        dealCount: dealCount > 0 ? dealCount : undefined,
        categoryCount: categoryCount > 0 ? categoryCount : undefined,
      };

      console.log(
        `✅ Saved: ${pageInfo.name} (${html.length} bytes, ${dealCount} deals, ${categoryCount} categories)`
      );

      return metadata;
    } catch (error) {
      console.error(
        `❌ Failed to fetch ${pageInfo.name}:`,
        (error as Error).message
      );
      throw error;
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

async function ensureDirectoryExists(): Promise<void> {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    console.log(`📁 Created fixtures directory: ${FIXTURES_DIR}`);
  }
}

async function main(): Promise<void> {
  console.log('🔄 Starting live page fetching for dealabs.com...');

  await ensureDirectoryExists();

  const fetcher = new LivePageFetcher();
  const allMetadata: PageMetadata[] = [];

  try {
    await fetcher.initialize();

    for (const pageInfo of PAGES_TO_FETCH) {
      try {
        const metadata = await fetcher.fetchPage(pageInfo);
        allMetadata.push(metadata);

        // Small delay between requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to fetch ${pageInfo.name}, continuing...`);
        // Continue with other pages even if one fails
      }
    }

    // Save metadata
    fs.writeFileSync(
      METADATA_FILE,
      JSON.stringify(allMetadata, null, 2),
      'utf-8'
    );
    console.log(
      `📊 Saved metadata for ${allMetadata.length} pages to: ${METADATA_FILE}`
    );
  } finally {
    await fetcher.close();
  }

  console.log('✨ Live page fetching completed!');
  console.log(`📁 HTML files saved to: ${FIXTURES_DIR}`);
  console.log(`📋 Metadata saved to: ${METADATA_FILE}`);

  // Print summary
  console.log('\n📈 Summary:');
  allMetadata.forEach((metadata) => {
    console.log(
      `  ${metadata.name}: ${metadata.size} bytes, ${metadata.dealCount || 0} deals`
    );
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export type { LivePageFetcher, PageToFetch, PageMetadata };
