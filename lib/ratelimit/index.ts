// TODO: Implement in Step 12 (Security Gate)
// Stub for TypeScript during test-first Step 11.

export interface RatelimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until window resets
}

export interface Ratelimit {
  limit(identifier: string): Promise<RatelimitResult>;
}

export interface InMemoryRatelimitOptions {
  limit: number;
  windowMs: number;
}

export class InMemoryRatelimit implements Ratelimit {
  private _options: InMemoryRatelimitOptions;

  constructor(options: InMemoryRatelimitOptions) {
    this._options = options;
  }

  async limit(_identifier: string): Promise<RatelimitResult> {
    // Stub — always blocks. Real implementation in Step 12.
    return { allowed: false, remaining: 0, retryAfter: 60 };
  }
}
