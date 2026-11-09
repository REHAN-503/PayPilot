export class LlmUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

export class HallucinatedProductIdError extends Error {
  constructor(message: string, public readonly productId?: string) {
    super(message);
    this.name = 'HallucinatedProductIdError';
  }
}

export class ForbiddenActionError extends Error {
  constructor(message: string, public readonly toolName?: string) {
    super(message);
    this.name = 'ForbiddenActionError';
  }
}

