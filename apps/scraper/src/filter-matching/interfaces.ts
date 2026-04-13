export interface FilterExpression {
  // Category filtering
  categories?: string[];
  subcategories?: string[];
  categoryPath?: string;

  // Price filtering
  minPrice?: number;
  maxPrice?: number;
  currency?: string;

  // Quality/Community filtering
  minHeat?: number;
  maxHeat?: number;
  communityVerified?: boolean;
  minRating?: number;

  // Merchant filtering
  preferredMerchants?: string[];
  excludedMerchants?: string[];
  merchantTypes?: ('official' | 'marketplace' | 'third-party')[];

  // Deal type filtering
  dealTypes?: ('direct' | 'coupon' | 'cashback' | 'bundle' | 'freebie')[];
  exclusivityLevels?: ('public' | 'members' | 'premium')[];

  // Content filtering
  titlePattern?: string;
  titleKeywords?: string[];
  descriptionKeywords?: string[];
  excludedKeywords?: string[];

  // Temporal filtering
  maxDealAge?: number; // hours
  publishedAfter?: Date;
  expiresAfter?: Date;

  // Shipping filtering
  freeShipping?: boolean;
  pickupAvailable?: boolean;
  maxShippingCost?: number;

  // Advanced filtering
  minDiscount?: number; // percentage
  maxDiscount?: number; // percentage
  minScore?: number; // minimum match score required
}

export interface NotificationSettings {
  email?: boolean;
  push?: boolean;
  inApp?: boolean;
  frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
  maxPerDay?: number;
  quietHours?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
  channels?: {
    email?: string;
    pushToken?: string;
  };
}

export interface FilterStats {
  totalMatches: number;
  matchesLast24h: number;
  matchesLast7d: number;
  avgScore: number;
  topScore: number;
  lastMatchAt?: Date;
}

export interface MatchDetails {
  id: string;
  filterId: string;
  filterName: string;
  articleId: string;
  score: number;
  reasons: string[];
  notified: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  article: {
    id: string;
    title: string;
    currentPrice: number;
    originalPrice?: number;
    temperature: number;
    merchant: string;
    category: string;
    dealUrl: string;
    imageUrl?: string;
    scrapedAt: Date;
    expiresAt?: Date;
  };
}
