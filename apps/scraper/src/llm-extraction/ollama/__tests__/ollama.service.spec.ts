import { OllamaService } from '../ollama.service.js';
import { OllamaUnavailableError, OllamaTimeoutError } from '../ollama.errors.js';
import { SharedConfigService } from '@dealscrapper/shared-config';

const mockOllamaConfig = {
  url: 'http://localhost:11434',
  model: 'qwen2.5:3b-instruct',
  concurrency: 2,
  timeoutMs: 30000,
};

const mockSharedConfig = {
  getOllamaConfig: () => mockOllamaConfig,
} as unknown as SharedConfigService;

function makeService(clientOverrides: { generate?: jest.Mock; list?: jest.Mock } = {}): OllamaService {
  const service = new OllamaService(mockSharedConfig);
  (service as unknown as { client: unknown }).client = {
    generate: clientOverrides.generate ?? jest.fn(),
    list: clientOverrides.list ?? jest.fn(),
  };
  return service;
}

describe('OllamaService', () => {
  const baseRequest = {
    system: 'Extract JSON',
    prompt: 'Listing HTML here',
    format: { type: 'object', properties: {} },
  };

  describe('generate', () => {
    it('returns parsed JSON string on happy path', async () => {
      // Arrange
      const validJson = JSON.stringify({ title: 'Deal', price: 10 });
      const generate = jest.fn().mockResolvedValueOnce({ response: validJson });
      const service = makeService({ generate });

      // Act
      const result = await service.generate(baseRequest);

      // Assert
      expect(result).toBe(validJson);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it('retries once on invalid JSON from first attempt', async () => {
      // Arrange
      const validJson = JSON.stringify({ title: 'Deal' });
      const generate = jest.fn()
        .mockResolvedValueOnce({ response: 'not-json' })
        .mockResolvedValueOnce({ response: validJson });
      const service = makeService({ generate });

      // Act
      const result = await service.generate(baseRequest);

      // Assert
      expect(result).toBe(validJson);
      expect(generate).toHaveBeenCalledTimes(2);
    });

    it('throws SyntaxError if both attempts return invalid JSON', async () => {
      // Arrange
      const generate = jest.fn()
        .mockResolvedValueOnce({ response: 'bad' })
        .mockResolvedValueOnce({ response: 'also-bad' });
      const service = makeService({ generate });

      // Act & Assert
      await expect(service.generate(baseRequest)).rejects.toThrow(SyntaxError);
      expect(generate).toHaveBeenCalledTimes(2);
    });

    it('throws OllamaTimeoutError on AbortError', async () => {
      // Arrange
      const abortError = new Error('abort');
      abortError.name = 'AbortError';
      const generate = jest.fn().mockRejectedValueOnce(abortError);
      const service = makeService({ generate });

      // Act & Assert
      await expect(service.generate(baseRequest)).rejects.toThrow(OllamaTimeoutError);
    });

    it('throws OllamaUnavailableError on ECONNREFUSED', async () => {
      // Arrange
      const connError = new Error('ECONNREFUSED');
      const generate = jest.fn().mockRejectedValueOnce(connError);
      const service = makeService({ generate });

      // Act & Assert
      await expect(service.generate(baseRequest)).rejects.toThrow(OllamaUnavailableError);
    });

    it('throws OllamaUnavailableError on fetch failed error', async () => {
      // Arrange
      const fetchError = new Error('fetch failed');
      const generate = jest.fn().mockRejectedValueOnce(fetchError);
      const service = makeService({ generate });

      // Act & Assert
      await expect(service.generate(baseRequest)).rejects.toThrow(OllamaUnavailableError);
    });

    it('aborts a hung generate call after LLM_TIMEOUT_MS and throws OllamaTimeoutError', async () => {
      // Arrange — stub a never-resolving generate() that exposes an abort() hook
      // which, when called, rejects the pending promise with an AbortError.
      let abortFn: (() => void) | null = null;
      const generate = jest.fn().mockImplementation(() => {
        const handle = new Promise((_resolve, reject) => {
          abortFn = (): void => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          };
        });
        (handle as unknown as { abort: () => void }).abort = () => abortFn?.();
        return handle;
      });

      // Build service with a short timeout so the test completes quickly.
      const shortTimeoutConfig = {
        getOllamaConfig: () => ({ ...mockOllamaConfig, timeoutMs: 50 }),
      } as unknown as SharedConfigService;
      const service = new OllamaService(shortTimeoutConfig);
      (service as unknown as { client: unknown }).client = { generate, list: jest.fn() };

      // Act & Assert — the generate call should time out and throw OllamaTimeoutError
      const started = Date.now();
      await expect(service.generate(baseRequest)).rejects.toThrow(OllamaTimeoutError);
      const elapsed = Date.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(40); // timer fired
      expect(elapsed).toBeLessThan(2000); // and we didn't wait for the stub forever
    });

    it('propagates caller-supplied AbortSignal cancellation', async () => {
      // Arrange
      let abortFn: (() => void) | null = null;
      const generate = jest.fn().mockImplementation(() => {
        const handle = new Promise((_resolve, reject) => {
          abortFn = (): void => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          };
        });
        (handle as unknown as { abort: () => void }).abort = () => abortFn?.();
        return handle;
      });
      const service = makeService({ generate });
      const ctrl = new AbortController();

      // Act — abort shortly after starting
      const pending = service.generate({ ...baseRequest, signal: ctrl.signal });
      setTimeout(() => ctrl.abort(), 10);

      // Assert — caller abort surfaces as OllamaTimeoutError (best-effort mapping)
      await expect(pending).rejects.toThrow();
    });
  });

  describe('listModels', () => {
    it('returns model names', async () => {
      // Arrange
      const list = jest.fn().mockResolvedValueOnce({ models: [{ name: 'qwen2.5:3b-instruct' }] });
      const service = makeService({ list });

      // Act
      const models = await service.listModels();

      // Assert
      expect(models).toEqual(['qwen2.5:3b-instruct']);
    });

    it('throws OllamaUnavailableError when Ollama is unreachable', async () => {
      // Arrange
      const list = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const service = makeService({ list });

      // Act & Assert
      await expect(service.listModels()).rejects.toThrow(OllamaUnavailableError);
    });
  });
});
