// Template interfaces for type safety and consistency across all notification channels
import { SiteSource } from '@dealscrapper/shared-types';

export interface BaseTemplateContext {
  timestamp: Date;
  locale?: string;
  timezone?: string;
}

export interface UserContext {
  id: string;
  name?: string;
  email?: string;
  preferences?: {
    language?: string;
    currency?: string;
    timezone?: string;
  };
}

export interface DealContext {
  id?: string;
  title: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  merchant: string;
  merchantLogo?: string;
  score: number;
  url: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  discountPercentage?: number;
  savings?: number;
  expiresAt?: Date;
  condition?: 'new' | 'used' | 'refurbished';
  shipping?: {
    cost: number;
    free: boolean;
    provider: string;
  };
  // Site identification (REQUIRED for multi-site support)
  siteId: SiteSource;
  // Site-specific fields (Vinted)
  brand?: string;
  // Site-specific fields (LeBonCoin)
  city?: string;
  sellerName?: string;
}

export interface FilterContext {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isActive: boolean;
  criteria?: {
    minScore?: number;
    maxPrice?: number;
    categories?: string[];
    merchants?: string[];
    keywords?: string[];
  };
}

export interface SystemContext {
  subject: string;
  message: string;
  priority: 'high' | 'normal' | 'low';
  type: 'maintenance' | 'security' | 'feature' | 'billing' | 'general';
  actionRequired?: boolean;
  actionUrl?: string;
  actionText?: string;
  expiresAt?: Date;
}

export interface DigestContext {
  frequency: 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  matches: Array<{
    id: string;
    title: string;
    price: number;
    originalPrice?: number;
    url: string;
    score: number;
    merchant: string;
    filterName: string;
    filterId: string;
    matchedAt: Date;
    imageUrl?: string;
    savings?: number;
  }>;
  summary: {
    totalMatches: number;
    averageScore: number;
    totalSavings: number;
    topMerchant: string;
    topCategory: string;
  };
}

export interface BrandingContext {
  appName: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  supportEmail: string;
  supportPhone?: string;
  websiteUrl?: string;
  socialMedia?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
  legal?: {
    termsUrl?: string;
    privacyUrl?: string;
    unsubscribeUrl?: string;
    companyName?: string;
    companyAddress?: string;
  };
}

export interface NotificationMetadata {
  id: string;
  type:
    | 'deal-match'
    | 'system'
    | 'digest'
    | 'verification'
    | 'welcome'
    | 'reminder';
  channel: 'email' | 'websocket';
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
  userId: string;
  templateUsed: string;
  tracking?: {
    campaignId?: string;
    sourceId?: string;
    experimentId?: string;
    segmentId?: string;
  };
}

// Complete template data interface that combines all contexts
export interface TemplateData extends BaseTemplateContext {
  user?: UserContext;
  deal?: DealContext;
  filter?: FilterContext;
  system?: SystemContext;
  digest?: DigestContext;
  branding?: BrandingContext;
  metadata?: NotificationMetadata;
}

// Template output interface for consistent response format
export interface TemplateOutput {
  // Common fields for all channels
  title: string;
  body: string;

  // Channel-specific fields
  subject?: string; // Email
  htmlBody?: string; // Email
  preheader?: string; // Email preview text

  // SMS specific
  characterCount?: number; // SMS character count
  segmentCount?: number; // SMS segment count (for multi-part messages)

  // Metadata and tracking
  metadata?: {
    type: string;
    priority: string;
    estimatedSize?: number;
    hasImages?: boolean;
    hasButtons?: boolean;
    templateVersion?: string;
    generatedAt: Date;
    [key: string]: unknown;
  };

  // A/B testing and personalization
  variations?: {
    id: string;
    name: string;
    content: Partial<TemplateOutput>;
  }[];

  // Tracking and analytics
  tracking?: {
    openTrackingId?: string;
    clickTrackingId?: string;
    unsubscribeTrackingId?: string;
    pixelUrl?: string;
  };
}

// Template configuration for different scenarios
export interface TemplateConfig {
  name: string;
  description?: string;
  channels: Array<'email' | 'websocket'>;
  priority: 'high' | 'normal' | 'low';
  frequency?: {
    maxPerHour?: number;
    maxPerDay?: number;
    cooldownMinutes?: number;
  };
  targeting?: {
    userSegments?: string[];
    geolocation?: string[];
    deviceTypes?: string[];
    timeWindows?: Array<{ start: string; end: string; timezone?: string }>;
  };
  fallback?: {
    enabled: boolean;
    channels: Array<'email'>;
    delayMinutes: number;
  };
  personalization?: {
    useUserName: boolean;
    usePastBehavior: boolean;
    dynamicContent: boolean;
  };
}

// Template validation interface
export interface TemplateValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  performance?: {
    estimatedRenderTime: number;
    estimatedSize: number;
    complexityScore: number;
  };
}

// Template theme configuration
export interface TemplateTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    fontFamily: string;
    headingFont?: string;
    fontSize: {
      small: string;
      normal: string;
      large: string;
      xlarge: string;
    };
    lineHeight: {
      tight: number;
      normal: number;
      loose: number;
    };
  };
  spacing: {
    small: string;
    normal: string;
    large: string;
    xlarge: string;
  };
  borders: {
    radius: string;
    width: string;
    color: string;
  };
  shadows: {
    small: string;
    normal: string;
    large: string;
  };
}

// Template analytics interface
export interface TemplateAnalytics {
  templateId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    sent: number;
    delivered: number;
    opened?: number;
    clicked?: number;
    converted?: number;
    unsubscribed?: number;
    bounced?: number;
    complained?: number;
  };
  performance: {
    deliveryRate: number;
    openRate?: number;
    clickRate?: number;
    conversionRate?: number;
    unsubscribeRate?: number;
    bounceRate?: number;
    complaintRate?: number;
  };
  channelBreakdown: {
    [channel: string]: {
      sent: number;
      delivered: number;
      failed: number;
      rate: number;
    };
  };
  segmentBreakdown?: {
    [segment: string]: {
      sent: number;
      performance: {
        deliveryRate: number;
        engagementRate: number;
      };
    };
  };
}
