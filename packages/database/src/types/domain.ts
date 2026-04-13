// Cross-service domain types - business logic shared between services

// Category monitoring (scraper ↔ API)
export interface CategoryMonitoringInfo {
  categorySlug: string;
  activeFilters: number;
  totalUsers: number;
  lastScraped?: Date;
  isCurrentlyMonitored: boolean;
  shouldBeMonitored: boolean;
  priority: 'high' | 'normal' | 'low';
}

// Scraping job requests (API ↔ scraper)
export interface ScrapeJobRequest {
  categoryId: string;
  categorySlug: string;
  categoryUrl: string;
  priority: 'high' | 'normal' | 'low';
  source: string;
  metadata?: Record<string, any>;
}

// Filter change events (API → scraper → notifier)
export interface FilterChangeEvent {
  filterId: string;
  userId: string;
  action: 'created' | 'updated' | 'deleted';
  categoryIds: string[];
  timestamp: Date;
}

// Deal notification data (scraper → notifier)
export interface DealNotificationData {
  dealId: string;
  filterId: string;
  userId: string;
  score: number;
  dealData: {
    title: string;
    price: number;
    originalPrice?: number;
    merchant: string;
    url: string;
    imageUrl?: string;
    temperature: number;
  };
}

// System health metrics (all services)
export interface ServiceHealthMetrics {
  serviceName: string;
  version: string;
  uptime: number;
  lastHealthCheck: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    activeConnections?: number;
    requestsPerMinute?: number;
  };
}
