/**
 * React Hooks for Rate Limiting
 * 
 * Provides easy-to-use hooks for rate limiting in React components.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  RateLimiter,
  RateLimitConfig,
  RateLimitResult,
  RateLimitError,
  createRateLimiter,
  getSharedLimiter,
  isRateLimitError,
  formatRetryTime,
} from '@/utils/rateLimiter';

export interface UseRateLimitOptions extends RateLimitConfig {
  /** Whether to use a shared limiter (persists across component instances) */
  shared?: boolean;
  /** Name for shared limiter (required if shared is true) */
  sharedName?: string;
}

export interface UseRateLimitReturn {
  /** Whether a request is currently allowed */
  canRequest: boolean;
  /** Number of remaining requests in the window */
  remaining: number;
  /** Milliseconds until rate limit resets */
  resetMs: number;
  /** Human-readable retry time */
  retryAfterText: string;
  /** Check if can proceed (updates state) */
  checkAndProceed: () => Promise<boolean>;
  /** Execute a function with rate limiting */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Reset the rate limiter */
  reset: () => Promise<void>;
  /** Last rate limit error (if any) */
  lastError: RateLimitError | null;
  /** Clear the last error */
  clearError: () => void;
}

/**
 * Hook for rate limiting operations in components
 */
export function useRateLimit(options: UseRateLimitOptions): UseRateLimitReturn {
  const [canRequest, setCanRequest] = useState(true);
  const [remaining, setRemaining] = useState(options.maxRequests);
  const [resetMs, setResetMs] = useState(0);
  const [lastError, setLastError] = useState<RateLimitError | null>(null);
  
  const limiterRef = useRef<RateLimiter | null>(null);

  // Initialize or get the limiter
  useEffect(() => {
    if (options.shared && options.sharedName) {
      limiterRef.current = getSharedLimiter(options.sharedName, options);
    } else {
      limiterRef.current = createRateLimiter(options);
    }

    // Check initial state
    const checkState = async () => {
      if (limiterRef.current) {
        const result = await limiterRef.current.check();
        setCanRequest(result.allowed);
        setRemaining(result.remaining);
        setResetMs(result.resetMs);
      }
    };
    checkState();

    return () => {
      // Cleanup if not shared
      if (!options.shared) {
        limiterRef.current = null;
      }
    };
  }, [options.shared, options.sharedName, options.maxRequests, options.windowMs]);

  // Update reset countdown
  useEffect(() => {
    if (resetMs <= 0) return;

    const interval = setInterval(() => {
      setResetMs(prev => {
        const next = Math.max(0, prev - 1000);
        if (next === 0) {
          // Re-check availability when reset
          limiterRef.current?.check().then(result => {
            setCanRequest(result.allowed);
            setRemaining(result.remaining);
          });
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resetMs > 0]);

  const updateState = useCallback((result: RateLimitResult) => {
    setCanRequest(result.allowed);
    setRemaining(result.remaining);
    setResetMs(result.resetMs);
  }, []);

  const checkAndProceed = useCallback(async (): Promise<boolean> => {
    if (!limiterRef.current) return false;
    
    const result = await limiterRef.current.tryAcquire();
    updateState(result);
    
    if (!result.allowed) {
      const error = new RateLimitError(
        options.errorMessage ?? 'Rate limit exceeded',
        result
      );
      setLastError(error);
    }
    
    return result.allowed;
  }, [updateState, options.errorMessage]);

  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    if (!limiterRef.current) {
      throw new Error('Rate limiter not initialized');
    }
    
    try {
      const result = await limiterRef.current.execute(fn);
      // Update state after successful execution
      const info = await limiterRef.current.check();
      updateState({
        allowed: info.remaining > 0,
        remaining: info.remaining,
        resetMs: info.resetMs,
      });
      return result;
    } catch (error) {
      if (isRateLimitError(error)) {
        updateState({
          allowed: false,
          remaining: error.remaining,
          resetMs: error.resetMs,
          retryAfterMs: error.retryAfterMs,
        });
        setLastError(error);
      }
      throw error;
    }
  }, [updateState]);

  const reset = useCallback(async (): Promise<void> => {
    if (limiterRef.current) {
      await limiterRef.current.reset();
      setCanRequest(true);
      setRemaining(options.maxRequests);
      setResetMs(0);
      setLastError(null);
    }
  }, [options.maxRequests]);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    canRequest,
    remaining,
    resetMs,
    retryAfterText: formatRetryTime(resetMs),
    checkAndProceed,
    execute,
    reset,
    lastError,
    clearError,
  };
}

/**
 * Hook for a rate-limited async function
 * Returns a wrapped version of the function with rate limiting applied
 */
export function useRateLimitedFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: UseRateLimitOptions
): {
  call: (...args: TArgs) => Promise<TResult>;
  canCall: boolean;
  remaining: number;
  resetMs: number;
  isRateLimited: boolean;
  error: RateLimitError | null;
  clearError: () => void;
} {
  const {
    canRequest,
    remaining,
    resetMs,
    execute,
    lastError,
    clearError,
  } = useRateLimit(options);

  const call = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      return execute(() => fn(...args));
    },
    [execute, fn]
  );

  return {
    call,
    canCall: canRequest,
    remaining,
    resetMs,
    isRateLimited: !canRequest,
    error: lastError,
    clearError,
  };
}

/**
 * Hook for debounced + rate-limited search
 */
export function useDebouncedRateLimitedSearch<T>(
  searchFn: (query: string) => Promise<T>,
  options: UseRateLimitOptions & { debounceMs?: number }
): {
  search: (query: string) => void;
  results: T | null;
  isLoading: boolean;
  error: Error | null;
  canSearch: boolean;
  remaining: number;
} {
  const [results, setResults] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { canRequest, remaining, execute } = useRateLimit(options);
  
  const debounceMs = options.debounceMs ?? 300;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((query: string) => {
    // Cancel previous
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!query.trim()) {
      setResults(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    timeoutRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      
      try {
        const result = await execute(() => searchFn(query));
        if (!abortRef.current?.signal.aborted) {
          setResults(result);
          setError(null);
        }
      } catch (err) {
        if (!abortRef.current?.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          if (!isRateLimitError(err)) {
            setResults(null);
          }
        }
      } finally {
        if (!abortRef.current?.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);
  }, [execute, searchFn, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    search,
    results,
    isLoading,
    error,
    canSearch: canRequest,
    remaining,
  };
}

// Re-export utilities for convenience
export { isRateLimitError, formatRetryTime, RateLimitError };

