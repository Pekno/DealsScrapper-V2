import { readFileSync } from 'fs';
import { join } from 'path';
import TurndownService from 'turndown';
import type { LlmExample } from '../../site.interface.js';
import { validateLeBonCoinListing } from '../leboncoin.schema.js';

/**
 * Loads LeBonCoin fixtures from a directory. See the Dealabs equivalent for
 * the reasoning behind the lazy, `import.meta.url`-free design.
 */
export function loadLeBonCoinFixtures(dir: string): LlmExample[] {
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  return ['leboncoin-001', 'leboncoin-002', 'leboncoin-003'].map((name) => {
    const html = readFileSync(join(dir, `${name}.html`), 'utf-8');
    const expectedRaw: unknown = JSON.parse(readFileSync(join(dir, `${name}.expected.json`), 'utf-8'));
    const expectedOutput = validateLeBonCoinListing(expectedRaw);
    const markdown = turndown.turndown(html);
    return { html, markdown, expectedOutput };
  });
}
