import type { LlmExample } from '../site.interface.js';

export const DEALABS_SYSTEM_PROMPT = `You are a deal data extraction assistant. You extract structured information from Dealabs listing Markdown text and return valid JSON.

Rules:
- Extract externalId from the deal URL path: it is the last numeric segment (e.g. from "/bons-plans/product-name-3297895" extract "3297895").
- Extract currentPrice and originalPrice as integers in cents (e.g. 999 € → 99900). If the deal is free or no price is shown, return null.
- Extract publishedAt as an ISO 8601 string only if an absolute date is shown (e.g. "23 avr. 2026"). If the date is relative ("il y a 2h", "il y a 3 jours", "hier", "aujourd'hui") return null — do NOT attempt to convert relative dates to absolute ones.
- Return null for any field you cannot find or infer from the listing.
- Do not invent data. Only use information present in the listing.
- Return only the JSON object. No explanation, no markdown fences.`;

export function buildDealabsUserPrompt(markdown: string, examples: LlmExample[]): string {
  const exampleBlocks = examples.map((ex, i) =>
    `## Example ${i + 1}\n\nListing:\n${ex.markdown}\n\nOutput:\n${JSON.stringify(ex.expectedOutput, null, 2)}`,
  );

  const exampleSection = exampleBlocks.length > 0
    ? `${exampleBlocks.join('\n\n')}\n\n---\n\n`
    : '';

  return `${exampleSection}## Listing to extract\n\n${markdown}`;
}
