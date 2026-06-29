import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { scraperLogConfig } from '../../config/logging.config.js';

const MAX_MARKDOWN_CHARS = 3500;

/** Matches the LeBonCoin "featured listing" promo badge text exactly. */
const FEATURED_BADGE_RE = /^(?:annonce\s+)?à\s+la\s+une\.?$/i;

const TRACKING_ATTRS = [
  'data-analytics',
  'data-track',
  'data-gtm',
  'data-ga',
  'data-pixel',
  'data-event',
];

@Injectable()
export class HtmlToMarkdownService {
  private readonly logger = createServiceLogger(scraperLogConfig);
  private readonly turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
    });

    // Keep alt and title attributes on images
    this.turndown.addRule('images-with-alt', {
      filter: 'img',
      replacement: (_content, node) => {
        const alt = node.getAttribute('alt') ?? '';
        const title = node.getAttribute('title') ?? '';
        const src = node.getAttribute('src') ?? '';
        if (!src) return '';
        const titlePart = title ? ` "${title}"` : '';
        return `![${alt}](${src}${titlePart})`;
      },
    });
  }

  prepare(html: string, sourceUrl: string): string {
    const $ = cheerio.load(html);

    // Strip noise elements
    $('script, style, svg, noscript, iframe, canvas').remove();

    // NOTE: aria-hidden and sr-only (screen-reader-only) elements are intentionally
    // KEPT. On some sites (notably LeBonCoin) the price and location values live
    // ONLY inside these elements (e.g. <p class="sr-only">Prix: 195 €</p>,
    // <p class="sr-only">Située à Le Cannet 06110.</p>) — stripping them removed the
    // very fields we extract. Their text is clean, screen-reader-optimised, and a
    // strong signal for the LLM, so we preserve it.
    //
    // The one exception is the "featured listing" promo badge ("À la une" /
    // "Annonce à la une"), which is pure chrome the LLM otherwise mistakes for the
    // title. Strip those specific leaf elements by their text content.
    this.removeFeaturedBadges($);

    // Strip on* event attributes
    $('*').each((_i, el) => {
      if (el.type !== 'tag') return;
      const attrs = Object.keys(el.attribs);
      for (const attr of attrs) {
        if (attr.startsWith('on')) {
          delete el.attribs[attr];
        }
      }
    });

    // Strip base64 src attributes (they bloat the markdown)
    $('[src]').each((_i, el) => {
      if (el.type !== 'tag') return;
      const src = el.attribs['src'] ?? '';
      if (src.startsWith('data:')) {
        delete el.attribs['src'];
      }
    });

    // Strip tracking attributes and presentational class/id attributes.
    // Class/id are removed here (not in Turndown) so that Turndown's built-in
    // link and image rules still run and preserve href/src.
    $('*').each((_i, el) => {
      if (el.type !== 'tag') return;
      for (const attr of TRACKING_ATTRS) {
        delete el.attribs[attr];
      }
      delete el.attribs['class'];
      // Preserve id on article elements — sites encode the deal's external ID there (e.g. thread_3317035)
      if (el.tagName !== 'article') {
        delete el.attribs['id'];
      }
    });

    // Resolve relative URLs in href and src attributes
    $('[href], [src]').each((_i, el) => {
      if (el.type !== 'tag') return;
      for (const attr of ['href', 'src'] as const) {
        const val = el.attribs[attr];
        if (val && !val.startsWith('http') && !val.startsWith('//') && !val.startsWith('#')) {
          try {
            el.attribs[attr] = new URL(val, sourceUrl).toString();
          } catch {
            // Leave as-is if URL resolution fails
          }
        }
      }
    });

    const cleanedHtml = $.html();
    const markdown = this.turndown.turndown(cleanedHtml);
    const capped = markdown.length > MAX_MARKDOWN_CHARS;
    const output = markdown.slice(0, MAX_MARKDOWN_CHARS);

    this.logger.debug(
      `html-to-markdown inputHtml=${html.length} chars → markdown=${markdown.length} chars${capped ? ` (capped at ${MAX_MARKDOWN_CHARS})` : ''}`,
    );

    return output;
  }

  /**
   * Removes the LeBonCoin "featured listing" promo badge ("À la une" /
   * "Annonce à la une"). It is rendered as a leaf element whose entire text is
   * just the badge label; the small LLM otherwise mistakes it for the ad title.
   * Matched on own-text only so we never remove a container that also holds the
   * real title or other useful fields.
   */
  private removeFeaturedBadges($: cheerio.CheerioAPI): void {
    $('span, p, div').each((_i, el) => {
      const ownText = $(el).clone().children().remove().end().text().trim();
      if (FEATURED_BADGE_RE.test(ownText)) {
        $(el).remove();
      }
    });
  }
}
