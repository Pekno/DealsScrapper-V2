interface RuntimeConfig {
  API_URL: string;
  WS_URL: string;
  NOTIFIER_URL: string;
  SCRAPER_URL: string;
  SCHEDULER_URL: string;
}

const defaults: RuntimeConfig = {
  API_URL: 'http://localhost:3001',
  WS_URL: 'ws://localhost:3003',
  NOTIFIER_URL: 'http://localhost:3003',
  SCRAPER_URL: 'http://localhost:3002',
  SCHEDULER_URL: 'http://localhost:3004',
};

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__RUNTIME_CONFIG__) {
    return (window as unknown as Record<string, unknown>).__RUNTIME_CONFIG__ as RuntimeConfig;
  }
  return defaults;
}
