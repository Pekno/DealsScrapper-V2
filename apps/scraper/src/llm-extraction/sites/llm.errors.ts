export class UnknownSiteError extends Error {
  constructor(siteId: string) {
    super(`No LLM site module registered for site: ${siteId}`);
    this.name = 'UnknownSiteError';
  }
}

export class LlmValidationError extends Error {
  constructor(reason: string) {
    super(`LLM output validation failed: ${reason}`);
    this.name = 'LlmValidationError';
  }
}
