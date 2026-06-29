import { Injectable } from '@nestjs/common';
import { Ollama } from 'ollama';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { scraperLogConfig } from '../../config/logging.config.js';
import { OllamaUnavailableError, OllamaTimeoutError } from './ollama.errors.js';

export interface OllamaGenerateRequest {
  system: string;
  prompt: string;
  format: object;
  /**
   * Optional caller-supplied cancellation signal. Composed with the internal
   * `LLM_TIMEOUT_MS` controller — whichever fires first aborts the call.
   */
  signal?: AbortSignal;
}

/**
 * Links a child controller so it aborts when any of the given signals aborts.
 * Returns a cleanup function that removes the listeners.
 */
function linkAbortSignals(child: AbortController, signals: (AbortSignal | undefined)[]): () => void {
  const cleanup: Array<() => void> = [];
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      child.abort(signal.reason);
      continue;
    }
    const onAbort = (): void => child.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    cleanup.push(() => signal.removeEventListener('abort', onAbort));
  }
  return () => cleanup.forEach((fn) => fn());
}

@Injectable()
export class OllamaService {
  private readonly logger = createServiceLogger(scraperLogConfig);
  private readonly client: Ollama;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const config = this.sharedConfig.getOllamaConfig();
    this.client = new Ollama({ host: config.url });
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  async generate(req: OllamaGenerateRequest): Promise<string> {
    return this.attemptGenerate(req, false);
  }

  private async attemptGenerate(
    req: OllamaGenerateRequest,
    isRetry: boolean,
  ): Promise<string> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    const unlink = linkAbortSignals(controller, [req.signal]);

    try {
      const requestHandle = this.client.generate({
        model: this.model,
        system: req.system,
        prompt: req.prompt,
        format: req.format as Record<string, unknown>,
        options: { temperature: 0, num_ctx: 4096 },
        stream: false,
      });

      // The `ollama` client exposes `.abort()` on the promise returned by
      // `generate()`; wire our controller to it so timeouts actually cancel.
      const abortListener = (): void => {
        const maybeAbortable = requestHandle as unknown as { abort?: () => void };
        if (typeof maybeAbortable.abort === 'function') {
          maybeAbortable.abort();
        }
      };
      if (controller.signal.aborted) {
        abortListener();
      } else {
        controller.signal.addEventListener('abort', abortListener, { once: true });
      }

      const response = await requestHandle;
      const raw = response.response;

      try {
        JSON.parse(raw);
        return raw;
      } catch {
        if (isRetry) {
          this.logger.warn(
            `Ollama returned invalid JSON on retry, giving up — snippet: ${raw.slice(0, 100)}`,
            'OllamaService',
          );
          throw new SyntaxError(`Invalid JSON from Ollama: ${raw.slice(0, 200)}`);
        }
        this.logger.warn(
          `Ollama returned invalid JSON, retrying once — snippet: ${raw.slice(0, 100)}`,
          'OllamaService',
        );
        return this.attemptGenerate(req, true);
      }
    } catch (err) {
      if (controller.signal.aborted && !(req.signal?.aborted ?? false)) {
        const elapsed = Date.now() - started;
        this.logger.error(`Ollama request timed out model=${this.model} elapsedMs=${elapsed}`, undefined, 'OllamaService');
        throw new OllamaTimeoutError(elapsed);
      }
      if (err instanceof SyntaxError || err instanceof OllamaUnavailableError || err instanceof OllamaTimeoutError) {
        throw err;
      }
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('abort') || err.message.includes('timeout')) {
          const elapsed = Date.now() - started;
          this.logger.error(`Ollama request timed out model=${this.model} elapsedMs=${elapsed}`, undefined, 'OllamaService');
          throw new OllamaTimeoutError(elapsed);
        }
        if (
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('ENOTFOUND') ||
          err.message.includes('fetch failed') ||
          err.message.includes('network')
        ) {
          this.logger.error(`Ollama unreachable model=${this.model} — ${err.message}`, undefined, 'OllamaService');
          throw new OllamaUnavailableError(err);
        }
      }
      this.logger.error(
        `Ollama unexpected failure model=${this.model} — ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        'OllamaService',
      );
      throw new OllamaUnavailableError(err);
    } finally {
      clearTimeout(timer);
      unlink();
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.list();
      return response.models.map((m) => m.name);
    } catch (err) {
      throw new OllamaUnavailableError(err);
    }
  }
}
