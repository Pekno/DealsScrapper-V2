import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function detailedAnalysis() {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const filePath = path.join(fixturesDir, 'leboncoin-multimedia-catalog.html');
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  console.log('🔍 Detailed LeBonCoin Structure Analysis\n');

  const articles = $('article[data-qa-id="aditem_container"]');
  console.log(`Found ${articles.length} articles\n`);

  // Analyze first 3 items
  articles.slice(0, 3).each((index, element) => {
    const $article = $(element);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`ITEM ${index + 1}`);
    console.log('='.repeat(80));

    // Extract all possible fields
    const ariaLabel = $article.attr('aria-label');
    console.log(`Title (aria-label): ${ariaLabel}`);

    const h3 = $article.find('h3').first().text().trim();
    console.log(`Title (h3): ${h3}`);

    const url = $article.find('a[href*="/ad/"]').attr('href');
    console.log(`URL: ${url}`);

    // Extract ID from URL
    const idMatch = url?.match(/\/ad\/[^/]+\/(\d+)/);
    const id = idMatch ? idMatch[1] : null;
    console.log(`ID: ${id}`);

    const imgSrc = $article.find('img').first().attr('src');
    console.log(`Image: ${imgSrc?.substring(0, 80)}...`);

    // Try to find price
    const priceSelectors = [
      'p[data-qa-id="aditem_price"]',
      'span[data-qa-id="aditem_price"]',
      'div[data-qa-id="aditem_price"]',
      'p:contains("€")',
      'span:contains("€")',
    ];

    let price = null;
    for (const selector of priceSelectors) {
      const el = $article.find(selector).first();
      if (el.length > 0) {
        price = el.text().trim();
        if (price.includes('€')) {
          console.log(`Price (${selector}): ${price}`);
          break;
        }
      }
    }

    // Try to find location
    const locationSelectors = [
      'p[data-qa-id="aditem_location"]',
      'span[data-qa-id="aditem_location"]',
      'div[data-qa-id="aditem_location"]',
      'p:contains("Paris")',
      'p:contains("Île-de-France")',
    ];

    let location = null;
    for (const selector of locationSelectors) {
      const el = $article.find(selector).first();
      if (el.length > 0) {
        location = el.text().trim();
        if (location.length > 0 && !location.includes('€')) {
          console.log(`Location (${selector}): ${location}`);
          break;
        }
      }
    }

    // Try to find date
    const dateSelectors = [
      'p[data-qa-id="aditem_date"]',
      'time',
      '[datetime]',
      'p:contains("Aujourd")',
      'p:contains("hier")',
    ];

    let date = null;
    for (const selector of dateSelectors) {
      const el = $article.find(selector).first();
      if (el.length > 0) {
        const text = el.text().trim();
        const datetime = el.attr('datetime');
        if (text || datetime) {
          console.log(`Date (${selector}): ${datetime || text}`);
          break;
        }
      }
    }

    // List all paragraphs
    console.log('\nAll <p> elements:');
    $article.find('p').each((i, p) => {
      const text = $(p).text().trim();
      const qaId = $(p).attr('data-qa-id');
      if (text && i < 10) {
        console.log(
          `  ${i + 1}. ${qaId ? `[${qaId}] ` : ''}${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`
        );
      }
    });

    // List all data-qa-id attributes
    console.log('\nAll data-qa-id attributes:');
    const qaIds = new Set<string>();
    $article.find('[data-qa-id]').each((i, el) => {
      const qaId = $(el).attr('data-qa-id');
      if (qaId && !qaIds.has(qaId)) {
        qaIds.add(qaId);
        const text = $(el).text().trim().substring(0, 40);
        console.log(`  - ${qaId}: ${text}${text.length >= 40 ? '...' : ''}`);
      }
    });
  });

  console.log('\n\n✅ Analysis complete!');
}

detailedAnalysis().catch(console.error);
