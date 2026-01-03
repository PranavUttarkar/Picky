/**
 * Centralized Rate Limiting Utility
 * 
 * Provides client-side rate limiting for API calls and user actions.
 * Supports multiple strategies: sliding window, token bucket, and cooldown.
 * 
 * Usage:
 * ```ts
 * // Simple usage with decorator
 * const rateLimitedSearch = withRateLimit(searchUsers, { maxRequests: 10, windowMs: 60000 });
 * 
 * // Or create a reusable limiter
 * const searchLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 });
 * if (await searchLimiter.canProceed()) { ... }
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export type RateLimitStrategy = 'sliding-window' | 'token-bucket' | 'cooldown';

export interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Unique key to identify this limiter (for persistence) */
  key?: string;
  /** Strategy to use (default: sliding-window) */
  strategy?: RateLimitStrategy;
  /** Whether to persist state across app restarts (default: false) */
  persist?: boolean;
  /** Custom error message when rate limited */
  errorMessage?: string;
  /** Whether to queue and wait instead of rejecting (default: false) */
  waitOnLimit?: boolean;
  /** Maximum wait time in ms when waitOnLimit is true (default: 30000) */
  maxWaitMs?: number;
}

export interface RateLimitState {
  timestamps: number[];
  tokens?: number;
  lastRefill?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterMs?: number;
}

export class RateLimitError extends Error {
  public retryAfterMs: number;
  public remaining: number;
  public resetMs: number;

  constructor(message: string, result: RateLimitResult) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = result.retryAfterMs ?? result.resetMs;
    this.remaining = result.remaining;
    this.resetMs = result.resetMs;
  }
}

// ============================================================================
// In-Memory State Management
// ============================================================================

const memoryState = new Map<string, RateLimitState>();

async function getState(key: string, persist: boolean): Promise<RateLimitState> {
  // Check memory first
  const memState = memoryState.get(key);
  if (memState) return memState;

  // Check persistent storage if enabled
  if (persist) {
    try {
      const stored = await AsyncStorage.getItem(`ratelimit:${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as RateLimitState;
        memoryState.set(key, parsed);
        return parsed;
      }
    } catch {}
  }

  // Return fresh state
  const fresh: RateLimitState = { timestamps: [] };
  memoryState.set(key, fresh);
  return fresh;
}

async function setState(key: string, state: RateLimitState, persist: boolean): Promise<void> {
  memoryState.set(key, state);
  
  if (persist) {
    try {
      await AsyncStorage.setItem(`ratelimit:${key}`, JSON.stringify(state));
    } catch {}
  }
}

// ============================================================================
// Rate Limiting Strategies
// ============================================================================

/**
 * Sliding Window Rate Limiter
 * Counts requests within a rolling time window
 */
function checkSlidingWindow(
  state: RateLimitState,
  config: RateLimitConfig,
  now: number
): RateLimitResult {
  const windowStart = now - config.windowMs;
  
  // Remove expired timestamps
  state.timestamps = state.timestamps.filter(ts => ts > windowStart);
  
  const count = state.timestamps.length;
  const allowed = count < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count - (allowed ? 1 : 0));
  
  // Calculate reset time (when oldest request expires)
  const oldestTs = state.timestamps[0];
  const resetMs = oldestTs ? Math.max(0, oldestTs + config.windowMs - now) : 0;
  
  // Calculate retry time (when next slot opens)
  const retryAfterMs = allowed ? 0 : resetMs;

  if (allowed) {
    state.timestamps.push(now);
  }

  return { allowed, remaining, resetMs, retryAfterMs };
}

/**
 * Token Bucket Rate Limiter
 * Allows bursts up to bucket size, refills at constant rate
 */
function checkTokenBucket(
  state: RateLimitState,
  config: RateLimitConfig,
  now: number
): RateLimitResult {
  // Initialize tokens if not set
  if (state.tokens === undefined) {
    state.tokens = config.maxRequests;
    state.lastRefill = now;
  }

  // Calculate refill
  const timeSinceRefill = now - (state.lastRefill ?? now);
  const refillRate = config.maxRequests / config.windowMs; // tokens per ms
  const tokensToAdd = Math.floor(timeSinceRefill * refillRate);
  
  if (tokensToAdd > 0) {
    state.tokens = Math.min(config.maxRequests, state.tokens + tokensToAdd);
    state.lastRefill = now;
  }

  const allowed = state.tokens >= 1;
  const remaining = Math.max(0, Math.floor(state.tokens) - (allowed ? 1 : 0));
  
  // Time until next token
  const msPerToken = config.windowMs / config.maxRequests;
  const retryAfterMs = allowed ? 0 : Math.ceil(msPerToken - (timeSinceRefill % msPerToken));
  const resetMs = Math.ceil((config.maxRequests - state.tokens) * msPerToken);

  if (allowed) {
    state.tokens -= 1;
  }

  return { allowed, remaining, resetMs, retryAfterMs };
}

/**
 * Cooldown Rate Limiter
 * Simple cooldown between requests (maxRequests = 1 in this mode)
 */
function checkCooldown(
  state: RateLimitState,
  config: RateLimitConfig,
  now: number
): RateLimitResult {
  const lastRequest = state.timestamps[0] ?? 0;
  const timeSinceLast = now - lastRequest;
  const allowed = timeSinceLast >= config.windowMs;
  
  const retryAfterMs = allowed ? 0 : config.windowMs - timeSinceLast;
  
  if (allowed) {
    state.timestamps = [now];
  }

  return {
    allowed,
    remaining: allowed ? 0 : 0,
    resetMs: retryAfterMs,
    retryAfterMs,
  };
}

// ============================================================================
// Core Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private statePromise: Promise<RateLimitState> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      key: config.key ?? `limiter_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      strategy: config.strategy ?? 'sliding-window',
      persist: config.persist ?? false,
      errorMessage: config.errorMessage ?? 'Rate limit exceeded. Please try again later.',
      waitOnLimit: config.waitOnLimit ?? false,
      maxWaitMs: config.maxWaitMs ?? 30000,
    };
  }

  /**
   * Check if a request can proceed without consuming a slot
   */
  async check(): Promise<RateLimitResult> {
    const state = await getState(this.config.key, this.config.persist);
    const now = Date.now();

    // Clone state for checking without modifying
    const checkState: RateLimitState = {
      timestamps: [...state.timestamps],
      tokens: state.tokens,
      lastRefill: state.lastRefill,
    };

    switch (this.config.strategy) {
      case 'token-bucket':
        return checkTokenBucket(checkState, this.config, now);
      case 'cooldown':
        return checkCooldown(checkState, this.config, now);
      default:
        return checkSlidingWindow(checkState, this.config, now);
    }
  }

  /**
   * Try to acquire a slot, returns result with allowed status
   */
  async tryAcquire(): Promise<RateLimitResult> {
    const state = await getState(this.config.key, this.config.persist);
    const now = Date.now();

    let result: RateLimitResult;

    switch (this.config.strategy) {
      case 'token-bucket':
        result = checkTokenBucket(state, this.config, now);
        break;
      case 'cooldown':
        result = checkCooldown(state, this.config, now);
        break;
      default:
        result = checkSlidingWindow(state, this.config, now);
    }

    await setState(this.config.key, state, this.config.persist);
    return result;
  }

  /**
   * Wait until a slot is available, then acquire it
   */
  async waitAndAcquire(): Promise<RateLimitResult> {
    const startTime = Date.now();
    
    while (true) {
      const result = await this.tryAcquire();
      
      if (result.allowed) {
        return result;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed + result.retryAfterMs! > this.config.maxWaitMs) {
        throw new RateLimitError(
          `${this.config.errorMessage} (max wait time exceeded)`,
          result
        );
      }

      // Wait until retry time
      await new Promise(resolve => setTimeout(resolve, Math.min(result.retryAfterMs!, 1000)));
    }
  }

  /**
   * Check if can proceed, optionally waiting if configured
   */
  async canProceed(): Promise<boolean> {
    if (this.config.waitOnLimit) {
      try {
        await this.waitAndAcquire();
        return true;
      } catch {
        return false;
      }
    }

    const result = await this.tryAcquire();
    return result.allowed;
  }

  /**
   * Execute with rate limiting - throws RateLimitError if not allowed
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.config.waitOnLimit) {
      await this.waitAndAcquire();
      return fn();
    }

    const result = await this.tryAcquire();
    if (!result.allowed) {
      throw new RateLimitError(this.config.errorMessage, result);
    }
    return fn();
  }

  /**
   * Reset the rate limiter state
   */
  async reset(): Promise<void> {
    const fresh: RateLimitState = { timestamps: [] };
    await setState(this.config.key, fresh, this.config.persist);
  }

  /**
   * Get current state info
   */
  async getInfo(): Promise<{ remaining: number; resetMs: number }> {
    const result = await this.check();
    return { remaining: result.remaining, resetMs: result.resetMs };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new rate limiter instance
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Higher-order function to wrap an async function with rate limiting
 */
export function withRateLimit<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: RateLimitConfig
): (...args: TArgs) => Promise<TResult> {
  const limiter = createRateLimiter(config);
  
  return async (...args: TArgs): Promise<TResult> => {
    return limiter.execute(() => fn(...args));
  };
}

/**
 * Rate-limited fetch wrapper
 */
export function createRateLimitedFetch(config: RateLimitConfig): typeof fetch {
  const limiter = createRateLimiter(config);
  
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return limiter.execute(() => fetch(input, init));
  };
}

// ============================================================================
// Pre-configured Limiters for Common Use Cases
// ============================================================================

/** Limiters registry for shared instances */
const limiters = new Map<string, RateLimiter>();

/**
 * Get or create a shared limiter by name
 */
export function getSharedLimiter(name: string, config: RateLimitConfig): RateLimiter {
  const key = `shared:${name}`;
  let limiter = limiters.get(key);
  
  if (!limiter) {
    limiter = createRateLimiter({ ...config, key });
    limiters.set(key, limiter);
  }
  
  return limiter;
}

// Pre-configured rate limit configs for the app
export const RateLimitPresets = {
  /** For external APIs like Nominatim (1 req/sec) */
  externalApi: {
    maxRequests: 1,
    windowMs: 1000,
    strategy: 'cooldown' as const,
    errorMessage: 'Please wait before making another request.',
  },

  /** For search operations (10/min) */
  search: {
    maxRequests: 10,
    windowMs: 60_000,
    strategy: 'sliding-window' as const,
    errorMessage: 'Too many searches. Please wait a moment.',
  },

  /** For write operations like creating events/polls (3/min) */
  create: {
    maxRequests: 3,
    windowMs: 60_000,
    strategy: 'sliding-window' as const,
    errorMessage: 'Please wait before creating another item.',
  },

  /** For social actions like follow/vote (20/min) */
  socialAction: {
    maxRequests: 20,
    windowMs: 60_000,
    strategy: 'sliding-window' as const,
    errorMessage: 'Too many actions. Please slow down.',
  },

  /** For file uploads (5/min) */
  upload: {
    maxRequests: 5,
    windowMs: 60_000,
    strategy: 'sliding-window' as const,
    errorMessage: 'Too many uploads. Please wait.',
  },

  /** For reports (5/hour with persistence) */
  report: {
    maxRequests: 5,
    windowMs: 3600_000,
    strategy: 'sliding-window' as const,
    persist: true,
    errorMessage: 'You have submitted too many reports. Please try again later.',
  },

  /** For analytics events (batch-friendly, 30/sec) */
  analytics: {
    maxRequests: 30,
    windowMs: 1000,
    strategy: 'token-bucket' as const,
    waitOnLimit: true,
    maxWaitMs: 5000,
  },

  /** For friend requests (5/min with persistence) */
  friendRequest: {
    maxRequests: 5,
    windowMs: 60_000,
    strategy: 'sliding-window' as const,
    persist: true,
    errorMessage: 'Too many friend requests. Please wait.',
  },

  /** For group operations (3/min) */
  groupAction: {
    maxRequests: 3,
    windowMs: 60_000,
    strategy: 'sliding-window' as const,
    errorMessage: 'Please wait before creating/joining another group.',
  },
} as const;

// ============================================================================
// Utility Hooks and Helpers
// ============================================================================

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Format retry time for display
 */
export function formatRetryTime(ms: number): string {
  if (ms < 1000) return 'a moment';
  if (ms < 60_000) return `${Math.ceil(ms / 1000)} seconds`;
  if (ms < 3600_000) return `${Math.ceil(ms / 60_000)} minutes`;
  return `${Math.ceil(ms / 3600_000)} hours`;
}

/**
 * Create a debounced rate limiter that combines debounce with rate limiting
 * Useful for search inputs that should debounce AND respect rate limits
 */
export function createDebouncedRateLimiter<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: RateLimitConfig & { debounceMs: number }
): {
  call: (...args: TArgs) => Promise<TResult | undefined>;
  cancel: () => void;
  flush: () => Promise<TResult | undefined>;
} {
  const limiter = createRateLimiter(config);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: TArgs | null = null;
  let pendingResolve: ((value: TResult | undefined) => void) | null = null;
  let pendingReject: ((error: any) => void) | null = null;

  const execute = async (): Promise<TResult | undefined> => {
    if (!pendingArgs) return undefined;
    
    const args = pendingArgs;
    pendingArgs = null;
    
    try {
      const result = await limiter.execute(() => fn(...args));
      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    call: (...args: TArgs): Promise<TResult | undefined> => {
      return new Promise((resolve, reject) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          if (pendingResolve) pendingResolve(undefined);
        }
        
        pendingArgs = args;
        pendingResolve = resolve;
        pendingReject = reject;
        
        timeoutId = setTimeout(async () => {
          timeoutId = null;
          try {
            const result = await execute();
            if (pendingResolve) pendingResolve(result);
          } catch (error) {
            if (pendingReject) pendingReject(error);
          }
          pendingResolve = null;
          pendingReject = null;
        }, config.debounceMs);
      });
    },
    
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pendingResolve) pendingResolve(undefined);
      pendingArgs = null;
      pendingResolve = null;
      pendingReject = null;
    },
    
    flush: async (): Promise<TResult | undefined> => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      return execute();
    },
  };
}

// ============================================================================
// Global Rate Limit Manager
// ============================================================================

/**
 * Global manager for tracking all rate limiters and their states
 */
export const RateLimitManager = {
  /** Clear all rate limit states (useful for logout) */
  async clearAll(): Promise<void> {
    memoryState.clear();
    limiters.clear();
    
    try {
      const keys = await AsyncStorage.getAllKeys();
      const rateLimitKeys = keys.filter(k => k.startsWith('ratelimit:'));
      if (rateLimitKeys.length > 0) {
        await AsyncStorage.multiRemove(rateLimitKeys);
      }
    } catch {}
  },

  /** Get all active limiters info */
  async getStatus(): Promise<Record<string, { remaining: number; resetMs: number }>> {
    const status: Record<string, { remaining: number; resetMs: number }> = {};
    
    for (const [key, limiter] of limiters) {
      status[key] = await limiter.getInfo();
    }
    
    return status;
  },
};

export default {
  createRateLimiter,
  withRateLimit,
  createRateLimitedFetch,
  getSharedLimiter,
  RateLimitPresets,
  RateLimitManager,
  isRateLimitError,
  formatRetryTime,
};

