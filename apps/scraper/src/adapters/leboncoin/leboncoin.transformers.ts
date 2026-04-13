/**
 * LeBonCoin-specific transform functions for field extraction.
 * These handle LeBonCoin's unique data formats and patterns.
 */

export type TransformFunction = (value: string) => string | number;

/**
 * Parses LeBonCoin price format: "800 €" → 800
 *
 * @example
 * parsePrice("800 €") → 800
 * parsePrice("1 200 €") → 1200
 * parsePrice("Gratuit") → 0
 */
export function parsePrice(priceText: string): number {
  if (!priceText || priceText.toLowerCase().includes('gratuit')) {
    return 0;
  }

  // Remove everything except digits
  const cleaned = priceText.replace(/[^\d]/g, '');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses location string into city and postcode.
 *
 * @example
 * parseLocation("Lannoy 59390") → { city: "Lannoy", postcode: "59390" }
 * parseLocation("Champigny-sur-Marne 94500") → { city: "Champigny-sur-Marne", postcode: "94500" }
 */
export function parseLocation(
  locationText: string
): { city: string; postcode: string } | null {
  if (!locationText) return null;

  // Pattern: {City Name} {5-digit Postcode}
  // City may contain hyphens, spaces, and accented characters
  const match = locationText.match(/^(.+?)\s+(\d{5})$/);

  if (!match) return null;

  return {
    city: match[1].trim(),
    postcode: match[2],
  };
}

/**
 * Extracts city from location string.
 *
 * @example
 * extractCity("Lannoy 59390") → "Lannoy"
 * extractCity("Champigny-sur-Marne 94500") → "Champigny-sur-Marne"
 */
export function extractCity(locationText: string): string {
  return parseLocation(locationText)?.city ?? '';
}

/**
 * Extracts postcode from location string.
 *
 * @example
 * extractPostcode("Lannoy 59390") → "59390"
 * extractPostcode("Champigny-sur-Marne 94500") → "94500"
 */
export function extractPostcode(locationText: string): string {
  return parseLocation(locationText)?.postcode ?? '';
}

/**
 * Derives department from postcode (first 2 digits).
 *
 * @example
 * getDepartment("59390") → "59"
 * getDepartment("75001") → "75"
 * getDepartment("94500") → "94"
 */
export function getDepartment(postcode: string): string {
  if (!postcode || postcode.length < 2) return '';

  return postcode.substring(0, 2);
}

/**
 * Maps department code to region name.
 *
 * @example
 * getRegion("59") → "Hauts-de-France"
 * getRegion("75") → "Île-de-France"
 * getRegion("83") → "Provence-Alpes-Côte d'Azur"
 */
export function getRegion(department: string): string {
  const regionMap: Record<string, string> = {
    // Auvergne-Rhône-Alpes
    '01': 'Auvergne-Rhône-Alpes',
    '03': 'Auvergne-Rhône-Alpes',
    '07': 'Auvergne-Rhône-Alpes',
    '15': 'Auvergne-Rhône-Alpes',
    '26': 'Auvergne-Rhône-Alpes',
    '38': 'Auvergne-Rhône-Alpes',
    '42': 'Auvergne-Rhône-Alpes',
    '43': 'Auvergne-Rhône-Alpes',
    '63': 'Auvergne-Rhône-Alpes',
    '69': 'Auvergne-Rhône-Alpes',
    '73': 'Auvergne-Rhône-Alpes',
    '74': 'Auvergne-Rhône-Alpes',

    // Bourgogne-Franche-Comté
    '21': 'Bourgogne-Franche-Comté',
    '25': 'Bourgogne-Franche-Comté',
    '39': 'Bourgogne-Franche-Comté',
    '58': 'Bourgogne-Franche-Comté',
    '70': 'Bourgogne-Franche-Comté',
    '71': 'Bourgogne-Franche-Comté',
    '89': 'Bourgogne-Franche-Comté',
    '90': 'Bourgogne-Franche-Comté',

    // Bretagne
    '22': 'Bretagne',
    '29': 'Bretagne',
    '35': 'Bretagne',
    '56': 'Bretagne',

    // Centre-Val de Loire
    '18': 'Centre-Val de Loire',
    '28': 'Centre-Val de Loire',
    '36': 'Centre-Val de Loire',
    '37': 'Centre-Val de Loire',
    '41': 'Centre-Val de Loire',
    '45': 'Centre-Val de Loire',

    // Corse
    '2A': 'Corse',
    '2B': 'Corse',
    '20': 'Corse',

    // Grand Est
    '08': 'Grand Est',
    '10': 'Grand Est',
    '51': 'Grand Est',
    '52': 'Grand Est',
    '54': 'Grand Est',
    '55': 'Grand Est',
    '57': 'Grand Est',
    '67': 'Grand Est',
    '68': 'Grand Est',
    '88': 'Grand Est',

    // Hauts-de-France
    '02': 'Hauts-de-France',
    '59': 'Hauts-de-France',
    '60': 'Hauts-de-France',
    '62': 'Hauts-de-France',
    '80': 'Hauts-de-France',

    // Île-de-France
    '75': 'Île-de-France',
    '77': 'Île-de-France',
    '78': 'Île-de-France',
    '91': 'Île-de-France',
    '92': 'Île-de-France',
    '93': 'Île-de-France',
    '94': 'Île-de-France',
    '95': 'Île-de-France',

    // Normandie
    '14': 'Normandie',
    '27': 'Normandie',
    '50': 'Normandie',
    '61': 'Normandie',
    '76': 'Normandie',

    // Nouvelle-Aquitaine
    '16': 'Nouvelle-Aquitaine',
    '17': 'Nouvelle-Aquitaine',
    '19': 'Nouvelle-Aquitaine',
    '23': 'Nouvelle-Aquitaine',
    '24': 'Nouvelle-Aquitaine',
    '33': 'Nouvelle-Aquitaine',
    '40': 'Nouvelle-Aquitaine',
    '47': 'Nouvelle-Aquitaine',
    '64': 'Nouvelle-Aquitaine',
    '79': 'Nouvelle-Aquitaine',
    '86': 'Nouvelle-Aquitaine',
    '87': 'Nouvelle-Aquitaine',

    // Occitanie
    '09': 'Occitanie',
    '11': 'Occitanie',
    '12': 'Occitanie',
    '30': 'Occitanie',
    '31': 'Occitanie',
    '32': 'Occitanie',
    '34': 'Occitanie',
    '46': 'Occitanie',
    '48': 'Occitanie',
    '65': 'Occitanie',
    '66': 'Occitanie',
    '81': 'Occitanie',
    '82': 'Occitanie',

    // Pays de la Loire
    '44': 'Pays de la Loire',
    '49': 'Pays de la Loire',
    '53': 'Pays de la Loire',
    '72': 'Pays de la Loire',
    '85': 'Pays de la Loire',

    // Provence-Alpes-Côte d\'Azur
    '04': 'Provence-Alpes-Côte d\'Azur',
    '05': 'Provence-Alpes-Côte d\'Azur',
    '06': 'Provence-Alpes-Côte d\'Azur',
    '13': 'Provence-Alpes-Côte d\'Azur',
    '83': 'Provence-Alpes-Côte d\'Azur',
    '84': 'Provence-Alpes-Côte d\'Azur',

    // Overseas
    '971': 'Guadeloupe',
    '972': 'Martinique',
    '973': 'Guyane',
    '974': 'La Réunion',
    '976': 'Mayotte',
  };

  return regionMap[department] || '';
}

/**
 * Extracts ID from LeBonCoin URL.
 *
 * @example
 * extractIdFromUrl("/ad/ordinateurs/3104743089") → "3104743089"
 * extractIdFromUrl("https://www.leboncoin.fr/ad/ordinateurs/3104743089") → "3104743089"
 */
export function extractIdFromUrl(url: string): string {
  if (!url) return '';

  // Pattern: /ad/{category}/{id}
  const match = url.match(/\/ad\/[^/]+\/(\d+)/);
  return match ? match[1] : '';
}

/**
 * Normalizes relative LeBonCoin URLs to absolute URLs.
 *
 * @example
 * normalizeUrl("/ad/ordinateurs/3104743089") → "https://www.leboncoin.fr/ad/ordinateurs/3104743089"
 * normalizeUrl("https://www.leboncoin.fr/ad/...") → "https://www.leboncoin.fr/ad/..." (unchanged)
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const baseUrl = 'https://www.leboncoin.fr';

  return url.startsWith('/')
    ? `${baseUrl}${url}`
    : `${baseUrl}/${url}`;
}

/**
 * Extracts category from LeBonCoin URL.
 *
 * @example
 * extractCategoryFromUrl("/ad/ordinateurs/3104743089") → "ordinateurs"
 * extractCategoryFromUrl("/ad/multimedia/1234567890") → "multimedia"
 */
export function extractCategoryFromUrl(url: string): string {
  if (!url) return '';

  // Pattern: /ad/{category}/{id}
  const match = url.match(/\/ad\/([^/]+)\/\d+/);
  return match ? match[1] : '';
}

/**
 * Transforms department to full region name (used in field config).
 * Wrapper around getRegion for use in transform pipelines.
 */
export function departmentToRegion(department: string): string {
  return getRegion(department);
}
