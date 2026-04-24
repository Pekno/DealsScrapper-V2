import { readFileSync } from 'fs';
import { join } from 'path';
import TurndownService from 'turndown';
import type { LlmExample } from '../../site.interface.js';
import { validateVintedListing } from '../vinted.schema.js';

/**
 * Loads Vinted fixtures from a directory. See the Dealabs equivalent for
 * the reasoning behind the lazy, `import.meta.url`-free design.
 */
export function loadVintedFixtures(dir: string): LlmExample[] {
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  return ['vinted-001', 'vinted-002', 'vinted-003'].map((name) => {
    const html = readFileSync(join(dir, `${name}.html`), 'utf-8');
    const expectedRaw: unknown = JSON.parse(readFileSync(join(dir, `${name}.expected.json`), 'utf-8'));
    const expectedOutput = validateVintedListing(expectedRaw);
    const markdown = turndown.turndown(html);
    return { markdown, expectedOutput };
  });
}
