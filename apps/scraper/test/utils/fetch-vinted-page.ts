import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Quick utility to fetch a live Vinted page for selector analysis.
 * This is a temporary script for Phase 5 implementation.
 */
async function fetchVintedPage() {
  console.log('🚀 Fetching Vinted page for analysis...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });

    // Fetch Vinted women's clothing category (has many items)
    const url = 'https://www.vinted.fr/vetements?catalog[]=1904&order=newest_first';
    console.log(`📄 Loading: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for dynamic content to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get page content
    const html = await page.content();

    // Save to fixtures directory
    const fixturesDir = path.join(__dirname, '..', 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    const filePath = path.join(fixturesDir, 'vinted-women-catalog.html');
    fs.writeFileSync(filePath, html, 'utf-8');

    console.log(`✅ Saved HTML to: ${filePath}`);
    console.log(`📊 File size: ${(html.length / 1024).toFixed(2)} KB`);

    // Try to count item cards with various selectors
    const selectors = [
      'a[href*="/items/"]',
      '.feed-grid__item',
      '.item-box',
      '[data-testid*="item"]',
      'article',
    ];

    for (const selector of selectors) {
      try {
        const count = await page.$$eval(selector, (els) => els.length);
        console.log(`  ${selector}: ${count} elements`);
      } catch {
        console.log(`  ${selector}: Not found`);
      }
    }

    return filePath;
  } finally {
    await browser.close();
    console.log('✨ Done!');
  }
}

// Run automatically when executed directly
fetchVintedPage().catch((error) => {
  console.error('💥 Error:', error);
  process.exit(1);
});

export { fetchVintedPage };
