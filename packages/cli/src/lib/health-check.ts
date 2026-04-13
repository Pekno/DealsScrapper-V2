/**
 * Check if a service is healthy by hitting its health endpoint.
 */
export async function checkHealth(port: number, path = '/health/ready'): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Poll a service health endpoint until it's ready or timeout is reached.
 * @returns true if the service became healthy, false if timeout.
 */
export async function waitForHealth(opts: {
  port: number;
  path?: string;
  timeoutMs?: number;
  intervalMs?: number;
  onTick?: (elapsedMs: number) => void;
}): Promise<boolean> {
  const { port, path = '/health/ready', timeoutMs = 60_000, intervalMs = 2_000, onTick } = opts;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    // Try both /health/ready and / (for web service)
    if (await checkHealth(port, path) || await checkHealth(port, '/')) {
      return true;
    }

    onTick?.(Date.now() - start);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}
