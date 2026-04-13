import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Analyzes the fetched Vinted HTML to determine correct selectors.
 */
async function analyzeVintedHTML() {
  console.log('🔍 Analyzing Vinted HTML structure...\n');

  const htmlPath = path.join(__dirname, '..', 'fixtures', 'vinted-women-catalog.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  // Find item links
  console.log('📦 Item Links Analysis:');
  const itemLinks = $('a[href*="/items/"]');
  console.log(`  Total item links: ${itemLinks.length}`);

  if (itemLinks.length > 0) {
    const firstItem = $(itemLinks[0]);
    console.log(`\n  First item link structure:`);
    console.log(`    HTML: ${firstItem.toString().substring(0, 200)}...`);
    console.log(`    Classes: ${firstItem.attr('class')}`);
    console.log(`    Data attributes:`, Object.keys(firstItem.attr() || {}).filter(k => k.startsWith('data-')));
    console.log(`    Href: ${firstItem.attr('href')}`);
  }

  // Try to find the item card container
  console.log('\n\n📋 Potential Card Containers:');
  const containers = ['.feed-grid__item', '[data-testid*="item"]', 'article'];

  for (const selector of containers) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`\n  ${selector}: ${elements.length} elements found`);
      const first = $(elements[0]);

      // Look for nested content
      const title = first.find('p, h2, h3, span').filter((_, el) => {
        const text = $(el).text().trim();
        return text.length > 5 && text.length < 100;
      }).first();

      const price = first.find('*').filter((_, el) => {
        const text = $(el).text().trim();
        return /\d+[,.]?\d*\s*€/.test(text);
      }).first();

      const img = first.find('img').first();

      console.log(`    Title found: ${title.text()?.trim().substring(0, 50) || 'N/A'}`);
      console.log(`    Price found: ${price.text()?.trim() || 'N/A'}`);
      console.log(`    Image src: ${img.attr('src')?.substring(0, 80) || 'N/A'}`);
    }
  }

  // Analyze feed-grid__item specifically
  console.log('\n\n🎯 Deep Analysis of .feed-grid__item:');
  const feedItems = $('.feed-grid__item');
  if (feedItems.length > 0) {
    const firstFeedItem = $(feedItems[0]);
    console.log(`  Total feed items: ${feedItems.length}`);
    console.log(`  First item classes: ${firstFeedItem.attr('class')}`);

    // Find all text elements
    const textElements = firstFeedItem.find('*').filter((_, el) => {
      const text = $(el).text().trim();
      return text.length > 2 && text.length < 200;
    });

    console.log('\n  Text content found (first 10):');
    textElements.slice(0, 10).each((i, el) => {
      const $el = $(el);
      console.log(`    ${$el.prop('tagName')}.${$el.attr('class') || '(no class)'}: "${$el.text().trim().substring(0, 60)}"`);
    });

    // Find images
    const images = firstFeedItem.find('img');
    console.log(`\n  Images found: ${images.length}`);
    images.each((i, img) => {
      const $img = $(img);
      console.log(`    ${i + 1}. src="${$img.attr('src')?.substring(0, 80)}..."`);
      console.log(`       alt="${$img.attr('alt')?.substring(0, 60)}"`);
    });

    // Find links
    const links = firstFeedItem.find('a');
    console.log(`\n  Links found: ${links.length}`);
    links.each((i, link) => {
      const $link = $(link);
      console.log(`    ${i + 1}. href="${$link.attr('href')}"`);
    });
  }

  // Look for data-testid patterns
  console.log('\n\n🏷️  Data-testid Analysis:');
  const dataTestIds = new Set<string>();
  $('[data-testid]').each((_, el) => {
    const testId = $(el).attr('data-testid');
    if (testId) dataTestIds.add(testId);
  });

  console.log(`  Unique data-testid values: ${dataTestIds.size}`);
  const relevantTestIds = Array.from(dataTestIds).filter(id =>
    id.includes('item') || id.includes('card') || id.includes('feed')
  );
  console.log(`  Item-related test IDs:`, relevantTestIds.slice(0, 20));

  console.log('\n✨ Analysis complete!');
}

analyzeVintedHTML().catch((error) => {
  console.error('💥 Error:', error);
  process.exit(1);
});
