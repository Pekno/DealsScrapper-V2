import type { LlmExample } from '../site.interface.js';

export const VINTED_SYSTEM_PROMPT = `You are a listing data extraction assistant. You extract structured information from Vinted item listing Markdown text and return valid JSON.

Rules:
- Extract externalId from the item URL path: it is the numeric segment before the slug (e.g. from "/items/8675512211-school-days" extract "8675512211").
- Extract currentPrice as an integer in cents (e.g. 25 € → 2500). If no price is shown, return null.
- Extract favoriteCount as an integer. Return null if not shown.
- Extract brand and size as strings if shown. Return null if not found.
- publishedAt is usually not shown on Vinted catalog cards; return null unless explicitly present.
- originalPrice is null for Vinted (secondhand marketplace has no original price).
- merchant is always null (Vinted is peer-to-peer).
- Return null for any optional field you cannot find or infer from the listing.
- Do not invent data. Only use information present in the listing.
- Return only the JSON object. No explanation, no markdown fences.

Extracting condition (REQUIRED):
- On Vinted catalog cards the item condition is encoded in the image alt text using the pattern: état: <value>
  Examples: "état: Très bon état", "état: Bon état", "état: Neuf avec étiquette", "état: Satisfaisant"
- After Markdown conversion the image line looks like: ![..., état: Très bon état, ...](url)
  The condition is the French string immediately after "état:" in the alt text.
- Extract the French condition string exactly as-is. Do not translate it.
- If no "état:" pattern is present anywhere in the listing text, return null for condition.`;

export function buildVintedUserPrompt(markdown: string, examples: LlmExample[]): string {
  const exampleBlocks = examples.map((ex, i) =>
    `## Example ${i + 1}\n\nListing:\n${ex.markdown}\n\nOutput:\n${JSON.stringify(ex.expectedOutput, null, 2)}`,
  );

  const exampleSection = exampleBlocks.length > 0
    ? `${exampleBlocks.join('\n\n')}\n\n---\n\n`
    : '';

  return `${exampleSection}## Listing to extract\n\n${markdown}`;
}
