// Hybrid Cache Configuration for Next.js
export const CACHE_CONFIG = {
  // Redis Cache Settings
  redis: {
    ttl: 7200, // 2 hours
    maxKeys: 10000,
    keyPrefix: "prop:",
  },

  // Next.js Cache Settings
  nextjs: {
    // Static Generation with ISR
    revalidate: 300, // 5 minutes

    // Fetch Cache Settings
    fetchCache: {
      default: 300, // 5 minutes
      property: 600, // 10 minutes for individual properties
      search: 180, // 3 minutes for search results
      featured: 900, // 15 minutes for featured properties
    },
  },

  // Stale-While-Revalidate Settings
  swr: {
    staleTime: 60, // 1 minute
    maxAge: 300, // 5 minutes
  },

  // Cache Warming Settings
  warming: {
    enabled: true,
    batchSize: 50,
    interval: 3600, // 1 hour
    priority: ["featured", "recent", "popular"],
  },
} as const

// Cache Key Generators
export const getCacheKey = {
  property: (id: string | number) => `${CACHE_CONFIG.redis.keyPrefix}${id}`,
  search: (params: Record<string, any>) => {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = params[key]
          return result
        },
        {} as Record<string, any>,
      )
    return `${CACHE_CONFIG.redis.keyPrefix}search:${Buffer.from(JSON.stringify(sortedParams)).toString("base64")}`
  },
  featured: () => `${CACHE_CONFIG.redis.keyPrefix}featured`,
  stats: () => `${CACHE_CONFIG.redis.keyPrefix}stats`,
}

// Cache Headers for Next.js
export const getCacheHeaders = (maxAge: number, staleWhileRevalidate = 60) => ({
  "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  "CDN-Cache-Control": `public, max-age=${maxAge}`,
  "Vercel-CDN-Cache-Control": `public, max-age=${maxAge}`,
})

// Revalidation Tags for Next.js
export const CACHE_TAGS = {
  properties: "properties",
  property: (id: string | number) => `property-${id}`,
  search: "property-search",
  featured: "featured-properties",
} as const
