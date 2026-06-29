import { readFileSync } from 'fs';
import { join } from 'path';
import TurndownService from 'turndown';
import type { LlmExample } from '../../site.interface.js';
import { validateDealabsListing } from '../dealabs.schema.js';

/**
 * Loads Dealabs fixtures from a directory containing pairs of
 * `dealabs-00N.html` + `dealabs-00N.expected.json` files.
 *
 * Called lazily (from live specs in tests, or at first `getExamples()` call in
 * production if wired). Kept free of `import.meta.url` so the module parses under
 * both ESM production runtime and Jest's CJS test runtime.
 */
export function loadDealabsFixtures(dir: string): LlmExample[] {
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  return ['dealabs-001', 'dealabs-002', 'dealabs-003'].map((name) => {
    const html = readFileSync(join(dir, `${name}.html`), 'utf-8');
    const expectedRaw: unknown = JSON.parse(readFileSync(join(dir, `${name}.expected.json`), 'utf-8'));
    const expectedOutput = validateDealabsListing(expectedRaw);
    const markdown = turndown.turndown(html);
    return { html, markdown, expectedOutput };
  });
}
