import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { extractErrorMessage } from '@dealscrapper/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as https from 'https';

const COOKIE_FILTER_CONFIG = {
  LIST_URL: 'https://www.fanboy.co.nz/fanboy-cookiemonster.txt',
  CACHE_DIR: path.resolve('data'),
  SELECTORS_CACHE_FILE: 'cookie-filter-selectors.json',
  LIST_CACHE_FILE: 'fanboy-cookiemonster.txt',
  /** Re-fetch the list if cache is older than 7 days */
  CACHE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  FETCH_TIMEOUT_MS: 30000,
} as const;

/**
 * Parses the Fanboy Cookie Monster adblock filter list and extracts
 * CSS selectors for cookie/RGPD consent elements.
 *
 * These selectors are used to REMOVE elements from the DOM (not hide with CSS),
 * which avoids collateral damage on legitimate UI elements like dialogs and drawers.
 *
 * Adblock cosmetic filter syntax:
 * - `##.class`        → generic hide rule (applies to all sites)
 * - `##div#id`        → generic hide rule with element type
 * - `domain.com##.x`  → site-specific rule
 * - `!`               → comment line
 * - Other lines       → network/URL blocking rules (ignored here)
 */
@Injectable()
export class CookieFilterService implements OnModuleInit {
  private readonly logger = new Logger(CookieFilterService.name);
  private selectors: string[] = [];
  private isReady = false;

  async onModuleInit(): Promise<void> {
    try {
      await this.loadOrFetchFilterList();
      this.logger.log(`Cookie filter ready (${this.selectors.length} selectors)`);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.warn(`Failed to initialize cookie filter: ${errorMessage}`);
    }
  }

  /**
   * Returns the list of CSS selectors targeting cookie/consent elements.
   * Returns empty array if not yet loaded or if loading failed.
   */
  getSelectors(): string[] {
    return this.selectors;
  }

  isLoaded(): boolean {
    return this.isReady;
  }

  private async loadOrFetchFilterList(): Promise<void> {
    const cacheDir = COOKIE_FILTER_CONFIG.CACHE_DIR;
    const selectorsPath = path.join(cacheDir, COOKIE_FILTER_CONFIG.SELECTORS_CACHE_FILE);
    const listPath = path.join(cacheDir, COOKIE_FILTER_CONFIG.LIST_CACHE_FILE);

    // Check if cached selectors exist and are fresh
    try {
      const stat = await fs.stat(selectorsPath);
      const age = Date.now() - stat.mtimeMs;
      if (age < COOKIE_FILTER_CONFIG.CACHE_MAX_AGE_MS) {
        const cached = await fs.readFile(selectorsPath, 'utf-8');
        this.selectors = JSON.parse(cached);
        this.isReady = true;
        this.logger.debug('Loaded cookie filter selectors from cache');
        return;
      }
      this.logger.debug('Cookie filter cache expired, re-fetching...');
    } catch {
      this.logger.debug('No cached cookie filter selectors found, fetching...');
    }

    // Fetch the raw filter list
    const rawList = await this.fetchFilterList();

    // Cache the raw list
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(listPath, rawList, 'utf-8');

    // Parse into selectors
    this.selectors = this.parseFilterListToSelectors(rawList);
    this.isReady = true;

    // Cache the selectors
    await fs.writeFile(selectorsPath, JSON.stringify(this.selectors), 'utf-8');
    this.logger.debug(`Cached ${this.selectors.length} cookie filter selectors to ${selectorsPath}`);
  }

  private fetchFilterList(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Cookie filter list fetch timed out'));
      }, COOKIE_FILTER_CONFIG.FETCH_TIMEOUT_MS);

      https
        .get(COOKIE_FILTER_CONFIG.LIST_URL, (res) => {
          if (res.statusCode !== 200) {
            clearTimeout(timeout);
            reject(new Error(`HTTP ${res.statusCode} fetching cookie filter list`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            clearTimeout(timeout);
            resolve(Buffer.concat(chunks).toString('utf-8'));
          });
          res.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  /**
   * Parses adblock filter list into an array of CSS selectors.
   *
   * We extract cosmetic filter rules (lines containing `##`) and collect
   * the CSS selector part. These selectors will be used to find and remove
   * matching DOM elements.
   *
   * We skip:
   * - Comment lines (starting with `!`)
   * - Network/URL rules (no `##`)
   * - Exception rules (containing `#@#`)
   * - Extended CSS / procedural filters (`:has-text`, `:matches-css`, etc.)
   * - Overly broad selectors (`body`, `html`, `*`, `[role="dialog"]`, `.dialog`)
   */
  private parseFilterListToSelectors(rawList: string): string[] {
    const lines = rawList.split('\n');
    const selectors = new Set<string>();

    // Selectors that are too broad and would break legitimate page UI
    const blockedSelectors = new Set([
      'body', 'html', '*',
      '[role="dialog"]', '[role="alertdialog"]',
      'div[role="dialog"]', 'div[role="alertdialog"]',
      '.dialog', '.dialog-container', '.dialog-wrapper',
      '.modal-dialog',
      '.MuiDrawer-root', '.MuiDrawer-modal', '.MuiDrawer-paperAnchorDockedBottom',
      '.MuiDialog-root',
      '.drawer-wrapper',
      '.v-dialog', '.v-dialog__content',
    ]);

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;

      // Skip exception/whitelist rules
      if (trimmed.includes('#@#')) continue;

      // Only process cosmetic filter rules (element hiding)
      const cosmeticIndex = trimmed.indexOf('##');
      if (cosmeticIndex === -1) continue;

      // Extract the CSS selector part (after ##)
      const selector = trimmed.substring(cosmeticIndex + 2).trim();
      if (!selector) continue;

      // Skip extended CSS / procedural filters that aren't valid CSS
      if (
        selector.includes(':has-text(') ||
        selector.includes(':matches-css(') ||
        selector.includes(':upward(') ||
        selector.includes(':remove(') ||
        selector.includes(':style(') ||
        selector.includes(':xpath(') ||
        selector.includes(':min-text-length(') ||
        selector.includes(':watch-attr(') ||
        selector.includes(':others(')
      ) {
        continue;
      }

      // Skip overly broad selectors that would break legitimate UI
      if (blockedSelectors.has(selector)) continue;

      selectors.add(selector);
    }

    // Add common consent providers that the filter list may miss
    const extraSelectors = [
      '#didomi-host',
      '.didomi-popup-container',
      '#didomi-notice',
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#CybotCookiebotDialog',
      '#CybotCookiebotDialogBodyUnderlay',
      '.cc-window.cc-banner',
      '#tarteaucitronRoot',
      '#axeptio_overlay',
    ];
    for (const sel of extraSelectors) {
      selectors.add(sel);
    }

    return Array.from(selectors);
  }
}
