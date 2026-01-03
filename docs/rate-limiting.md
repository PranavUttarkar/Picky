# Rate Limiting System

This document describes the centralized rate limiting system for the Picky app.

## Overview

The rate limiting system provides client-side protection against:
- External API rate limits (Nominatim, Amplitude)
- Supabase request throttling
- User action spam (rapid voting, friend requests, etc.)

## Architecture

```
utils/rateLimiter.ts     - Core rate limiting logic
hooks/useRateLimit.ts    - React hooks for components
services/rateLimited.ts  - Pre-wrapped service functions
utils/geocoding.ts       - Rate-limited geocoding utilities
```

## Usage Patterns

### 1. Using Pre-Wrapped Services (Recommended)

Simply import from `@/services/rateLimited` instead of the original service:

```typescript
// Before
import { sendFriendRequest } from '@/services/friends';

// After - with rate limiting
import { sendFriendRequest } from '@/services/rateLimited';

// Usage is identical
await sendFriendRequest('username');
```

### 2. Using the React Hook

For components that need rate limit state:

```typescript
import { useRateLimit, RateLimitPresets } from '@/hooks/useRateLimit';

function MyComponent() {
  const { 
    canRequest, 
    remaining, 
    retryAfterText,
    execute 
  } = useRateLimit({
    ...RateLimitPresets.socialAction,
    key: 'my-action'
  });

  const handleAction = async () => {
    try {
      await execute(() => someApiCall());
    } catch (error) {
      if (isRateLimitError(error)) {
        Alert.alert('Slow down', error.message);
      }
    }
  };

  return (
    <Button 
      disabled={!canRequest}
      title={canRequest ? 'Submit' : `Wait ${retryAfterText}`}
      onPress={handleAction}
    />
  );
}
```

### 3. Using Rate-Limited Search Hook

For search inputs with debounce + rate limiting:

```typescript
import { useDebouncedRateLimitedSearch } from '@/hooks/useRateLimit';
import { searchUsers } from '@/services/rateLimited';

function SearchComponent() {
  const { search, results, isLoading, canSearch } = useDebouncedRateLimitedSearch(
    searchUsers,
    { maxRequests: 10, windowMs: 60000, debounceMs: 300 }
  );

  return (
    <TextInput 
      onChangeText={search}
      placeholder={canSearch ? 'Search...' : 'Rate limited'}
    />
  );
}
```

### 4. Manual Rate Limiter

For custom scenarios:

```typescript
import { createRateLimiter, withRateLimit } from '@/utils/rateLimiter';

// Create a limiter
const myLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60000,
  key: 'my-operation'
});

// Option A: Check and execute
if (await myLimiter.canProceed()) {
  await doSomething();
}

// Option B: Execute with auto-check
await myLimiter.execute(() => doSomething());

// Option C: Wrap a function
const rateLimitedFn = withRateLimit(originalFn, config);
```

### 5. Geocoding Utilities

For location-based features:

```typescript
import { geocodeAddress, reverseGeocode } from '@/utils/geocoding';

// These are automatically rate limited (1 req/sec for Nominatim)
const results = await geocodeAddress('123 Main St');
const address = await reverseGeocode(40.7128, -74.0060);
```

## Rate Limit Presets

| Preset | Max Requests | Window | Use Case |
|--------|-------------|--------|----------|
| `externalApi` | 1 | 1s | Nominatim, external APIs |
| `search` | 10 | 1min | Search operations |
| `create` | 3 | 1min | Creating events/polls |
| `socialAction` | 20 | 1min | Follow, vote, etc. |
| `upload` | 5 | 1min | File uploads |
| `report` | 5 | 1hr | Event reports |
| `friendRequest` | 5 | 1min | Friend requests |
| `groupAction` | 3 | 1min | Group create/join |
| `analytics` | 30 | 1s | Analytics events |

## Strategies

### Sliding Window (default)
Counts requests in a rolling time window. Best for most use cases.

### Token Bucket
Allows bursts up to bucket size, refills at constant rate. Best for APIs that allow short bursts.

### Cooldown
Simple fixed delay between requests. Best for strict rate limits like Nominatim.

## Configuration Options

```typescript
interface RateLimitConfig {
  maxRequests: number;      // Max requests in window
  windowMs: number;         // Window duration in ms
  key?: string;             // Unique identifier (for persistence)
  strategy?: 'sliding-window' | 'token-bucket' | 'cooldown';
  persist?: boolean;        // Persist across app restarts
  errorMessage?: string;    // Custom error message
  waitOnLimit?: boolean;    // Queue instead of reject
  maxWaitMs?: number;       // Max queue wait time
}
```

## Error Handling

```typescript
import { isRateLimitError, formatRetryTime } from '@/utils/rateLimiter';

try {
  await rateLimitedOperation();
} catch (error) {
  if (isRateLimitError(error)) {
    const waitTime = formatRetryTime(error.retryAfterMs);
    Alert.alert('Please wait', `Try again in ${waitTime}`);
  }
}
```

## Best Practices

1. **Use shared limiters** for global operations (search, geocoding)
2. **Enable persistence** for important limits (reports, friend requests)
3. **Use `waitOnLimit`** for analytics to queue instead of drop events
4. **Show UI feedback** when rate limited (disable buttons, show countdown)
5. **Combine with debounce** for search inputs to reduce unnecessary requests

## Clearing Rate Limits

```typescript
import { RateLimitManager } from '@/utils/rateLimiter';

// Clear all limits (e.g., on logout)
await RateLimitManager.clearAll();

// Get current status
const status = await RateLimitManager.getStatus();
```

