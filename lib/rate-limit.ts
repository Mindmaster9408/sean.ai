// Simple in-memory rate limiter using sliding window
// Resets every hour

type RateLimitKey = string;

interface RateLimitEntry {
  count: number;
  hourStart: number;
}

const rateLimits = new Map<RateLimitKey, RateLimitEntry>();

export function checkRateLimit(key: RateLimitKey, maxRequests: number = 60): boolean {
  const now = Date.now();
  const currentHour = Math.floor(now / (60 * 60 * 1000));
  
  let entry = rateLimits.get(key);

  // Reset if hour changed
  if (!entry || entry.hourStart !== currentHour) {
    entry = { count: 0, hourStart: currentHour };
    rateLimits.set(key, entry);
  }

  // Check limit
  if (entry.count >= maxRequests) {
    return false; // Rate limited
  }

  entry.count++;
  return true; // Allowed
}

export function getRateLimitKey(userId: string, endpoint: string): string {
  return `${endpoint}:${userId}`;
}

export function getRateLimitRemaining(key: RateLimitKey, maxRequests: number = 60): number {
  const now = Date.now();
  const currentHour = Math.floor(now / (60 * 60 * 1000));
  
  const entry = rateLimits.get(key);
  if (!entry || entry.hourStart !== currentHour) {
    return maxRequests;
  }

  return Math.max(0, maxRequests - entry.count);
}
