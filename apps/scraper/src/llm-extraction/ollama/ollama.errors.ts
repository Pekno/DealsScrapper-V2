export class OllamaUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      cause instanceof Error ? cause.message : 'Ollama server unreachable'
    );
    this.name = 'OllamaUnavailableError';
  }
}

export class OllamaTimeoutError extends Error {
  readonly elapsedMs: number;

  constructor(elapsedMs = 0) {
    super(`Ollama request timed out after ${elapsedMs}ms`);
    this.name = 'OllamaTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}
