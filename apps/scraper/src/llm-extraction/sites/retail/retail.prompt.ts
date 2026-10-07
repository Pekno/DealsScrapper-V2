import type { LlmExample } from '../site.interface.js';

/**
 * Shared system prompt for retail product-listing sites. Generic on purpose —
 * the same instructions work for Électro Dépôt, Fnac, Darty, Boulanger because
 * all four render a product card with title / price / rating / availability.
 */
export const RETAIL_SYSTEM_PROMPT = `You are a product data extraction assistant. You extract structured information from a retail product-listing card (in Markdown) and return valid JSON.

Rules:

Extracting externalId (REQUIRED):
- The externalId is the stable product identifier from the product URL — usually the last path segment or a numeric/SKU id in it. If none is obvious, use the full product page path.

Extracting title (REQUIRED):
- The title is the product name/headline of the card. Do not use the price, the brand alone, the category breadcrumb, or a button label ("Ajouter au panier", "Voir le produit").

Extracting url (REQUIRED):
- The href of the main product link. Always return the full absolute URL.

Extracting imageUrl:
- The src of the product thumbnail (a Markdown image ![...](...)). Return null if none.

Extracting currentPrice and originalPrice:
- Extract both as floats in euros. Convert the French decimal comma to a point ("199,99 €" -> 199.99, "1 299 €" -> 1299). Never drop digits before the comma.
- A price is a number attached to "€". When two prices appear, the first/lower is currentPrice and the crossed-out/was-price is originalPrice.
- If only one price is shown, originalPrice is null.

Extracting merchant:
- The store selling the product. For a single-retailer site this is the site itself; return null if nothing more specific is shown.

Extracting brand:
- The product brand/manufacturer when shown (e.g. "Samsung", "Bosch"). Return null if absent.

Extracting rating and reviewCount:
- rating is the average review score as a number (e.g. "4,5/5" -> 4.5). reviewCount is the integer number of reviews ("(128 avis)" -> 128). Return null when not shown.

Extracting availability:
- A short stock/availability string exactly as shown ("En stock", "Indisponible", "Sur commande", "Disponible en magasin"). Return null if absent.

Extracting ean:
- The barcode / GTIN / EAN if present (a 8-14 digit code). Return null otherwise.

General rules:
- Return null for any optional field you cannot find. Do not invent data.
- Return only the JSON object. No explanation, no markdown fences.`;

export function buildRetailUserPrompt(markdown: string, examples: LlmExample[]): string {
  const exampleBlocks = examples.map((ex, i) =>
    `## Example ${i + 1}\n\nListing:\n${ex.markdown}\n\nOutput:\n${JSON.stringify(ex.expectedOutput, null, 2)}`,
  );

  const exampleSection = exampleBlocks.length > 0
    ? `${exampleBlocks.join('\n\n')}\n\n---\n\n`
    : '';

  return `${exampleSection}## Listing to extract\n\n${markdown}`;
}
