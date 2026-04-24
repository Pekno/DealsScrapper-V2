import type { LlmExample } from '../site.interface.js';

export const LEBONCOIN_SYSTEM_PROMPT = `You are a listing data extraction assistant. You extract structured information from LeBonCoin ad listing Markdown text and return valid JSON.

Rules:
- Extract externalId from the ad URL path: it is the numeric segment at the end (e.g. from "/ad/accessoires_informatique/3155664945" extract "3155664945").
- Extract currentPrice as an integer in cents (e.g. 195 € → 19500). If no price is shown, return null.
- Extract location as "CityName POSTCODE" (e.g. "Le Cannet 06110"). Also split it into city and postcode fields.
- Extract sellerName if shown. Return null if not found.
- proSeller is true if seller is marked as "Pro" or professional. Default false.
- urgentFlag is true if the listing is marked as "Urgent". Default false.
- publishedAt is not usually shown on catalog cards; return null unless explicitly present.
- originalPrice is null (LeBonCoin secondhand listings have no original price).
- merchant is always null (LeBonCoin is peer-to-peer).
- Return null for any field you cannot find or infer from the listing.
- Do not invent data. Only use information present in the listing.
- Return only the JSON object. No explanation, no markdown fences.`;

export function buildLeBonCoinUserPrompt(markdown: string, examples: LlmExample[]): string {
  const exampleBlocks = examples.map((ex, i) =>
    `## Example ${i + 1}\n\nListing:\n${ex.markdown}\n\nOutput:\n${JSON.stringify(ex.expectedOutput, null, 2)}`,
  );

  const exampleSection = exampleBlocks.length > 0
    ? `${exampleBlocks.join('\n\n')}\n\n---\n\n`
    : '';

  return `${exampleSection}## Listing to extract\n\n${markdown}`;
}
