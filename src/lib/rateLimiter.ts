// Simple in-memory rate limiter for API routes
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const DEFAULT_LIMITS = {
  signal: { limit: 30, window: 60000 }, // 30 req/min
  prices: { limit: 120, window: 60000 }, // 120 req/min
  default: { limit: 60, window: 60000 }, // 60 req/min
};

export function checkRateLimit(
  identifier: string,
  type: 'signal' | 'prices' | 'default' = 'default'
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const config = DEFAULT_LIMITS[type];
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(identifier);
  }

  const currentEntry = rateLimitStore.get(identifier) || {
    count: 0,
    resetTime: now + config.window,
  };

  if (now > currentEntry.resetTime) {
    currentEntry.count = 0;
    currentEntry.resetTime = now + config.window;
  }

  if (currentEntry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: currentEntry.resetTime,
    };
  }

  currentEntry.count++;
  rateLimitStore.set(identifier, currentEntry);

  return {
    allowed: true,
    remaining: config.limit - currentEntry.count,
    resetTime: currentEntry.resetTime,
  };
}

export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  const ip = forwarded?.split(',')[0]?.trim() 
    || realIp 
    || cfConnectingIp 
    || 'unknown';
  
  return ip;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute
