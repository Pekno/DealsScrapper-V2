import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Analyzes fetched LeBonCoin HTML to document selectors and data structure.
 * Run after fetch-leboncoin-page.ts
 */
async function analyzeLeBonCoinHtml() {
  console.log('🔍 Analyzing LeBonCoin HTML structure...\n');

  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const filePath = path.join(fixturesDir, 'leboncoin-multimedia-catalog.html');

  if (!fs.existsSync(filePath)) {
    console.error('❌ HTML file not found. Run fetch-leboncoin-page.ts first.');
    return;
  }

  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  console.log('📊 Document Statistics:');
  console.log(`  Total HTML size: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total characters: ${html.length.toLocaleString()}\n`);

  // Find the container selector
  console.log('🔎 Testing container selectors:');
  const containerSelectors = [
    'article',
    'a[href*="/ad/"]',
    '[data-qa-id*="ad"]',
    'div[class*="ad"]',
    'div[class*="styles_"]',
  ];

  let bestSelector = 'article'; // LeBonCoin uses <article> for each ad
  let maxCount = $('article').length;

  for (const selector of containerSelectors) {
    const count = $(selector).length;
    console.log(`  ${selector}: ${count} elements`);
  }

  console.log(`\n✅ Using container selector: "${bestSelector}" (${maxCount} items)\n`);

  // Analyze first item in detail
  const firstItem = $(bestSelector).first();
  if (firstItem.length === 0) {
    console.error('❌ No items found with best selector');
    return;
  }

  console.log('🎯 Analyzing first item structure:');
  console.log('─'.repeat(80));

  // Get outer HTML (limited to first 1000 chars)
  const outerHtml = $.html(firstItem).substring(0, 2000);
  console.log(outerHtml);
  console.log('─'.repeat(80));

  // Test various field selectors
  console.log('\n📋 Field Analysis (first item):');

  const fieldSelectors = {
    title: [
      'h2',
      '[data-qa-id="aditem_title"]',
      'p[data-qa-id="aditem_title"]',
      'a[title]',
      'div[class*="title"]',
    ],
    price: [
      '[data-qa-id="aditem_price"]',
      'p[data-qa-id="aditem_price"]',
      'span[class*="price"]',
      'div[class*="price"]',
      '[aria-label*="prix"]',
    ],
    location: [
      '[data-qa-id="aditem_location"]',
      'p[data-qa-id="aditem_location"]',
      '[class*="location"]',
      'span[class*="location"]',
    ],
    date: [
      '[data-qa-id="aditem_date"]',
      '[class*="date"]',
      'time',
      '[datetime]',
    ],
    image: ['img', 'picture img', '[data-qa-id*="image"]'],
    url: ['a[href*="/ad/"]', 'a[href*="leboncoin"]'],
  };

  const results: Record<string, any> = {};

  for (const [fieldName, selectors] of Object.entries(fieldSelectors)) {
    console.log(`\n  ${fieldName.toUpperCase()}:`);

    for (const selector of selectors) {
      const element = firstItem.find(selector).first();

      if (element.length > 0) {
        let value: string;

        if (fieldName === 'image') {
          value = element.attr('src') || element.attr('data-src') || 'N/A';
        } else if (fieldName === 'url') {
          value = element.attr('href') || 'N/A';
        } else if (fieldName === 'date') {
          value =
            element.attr('datetime') || element.text().trim() || 'N/A';
        } else {
          value = element.text().trim() || 'N/A';
        }

        console.log(`    ✅ ${selector}: "${value.substring(0, 80)}${value.length > 80 ? '...' : ''}"`);

        if (!results[fieldName]) {
          results[fieldName] = { selector, value };
        }
      } else {
        console.log(`    ❌ ${selector}: Not found`);
      }
    }
  }

  // Extract ID from URL if possible
  console.log('\n  ID EXTRACTION:');
  const urlElement = firstItem.find('a[href*="/ad/"]').first();
  const url = urlElement.attr('href') || '';
  const idMatch = url.match(/\/ad\/([^/?]+)/);
  if (idMatch) {
    console.log(`    ✅ ID from URL: ${idMatch[1]}`);
    results.id = { selector: 'a[href*="/ad/"]', value: idMatch[1] };
  }

  // Look for attributes in data-qa-id or other attributes
  console.log('\n  DATA ATTRIBUTES:');
  const dataAttrs = firstItem.find('[data-qa-id]');
  if (dataAttrs.length > 0) {
    dataAttrs.each((i, el) => {
      if (i < 10) {
        // Limit output
        const qaId = $(el).attr('data-qa-id');
        const text = $(el).text().trim().substring(0, 50);
        console.log(`    [data-qa-id="${qaId}"]: ${text}`);
      }
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📝 RECOMMENDED SELECTORS SUMMARY:');
  console.log('='.repeat(80));
  console.log(`Container: ${bestSelector}`);
  Object.entries(results).forEach(([field, data]) => {
    console.log(`${field}: ${data.selector}`);
  });

  console.log('\n✨ Analysis complete!');
  console.log(
    `\n💡 Next: Create LEBONCOIN_SELECTORS.md with these findings.`
  );
}

// Run automatically when executed directly
analyzeLeBonCoinHtml().catch((error) => {
  console.error('💥 Error:', error);
  process.exit(1);
});

export { analyzeLeBonCoinHtml };
