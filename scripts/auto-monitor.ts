// Automatic Cache Monitoring and Warming
import { enhancedHybridCacheService } from '../lib/enhanced-hybrid-cache-service'

async function autoWarmCache() {
  try {
    const stats = enhancedHybridCacheService.getEnhancedStats()
    
    // Warm cache if hit rate is below 70%
    if (stats.hitRates.redis < 70) {
      console.log(`🔥 Auto-warming cache (hit rate: ${stats.hitRates.redis.toFixed(1)}%)`)
      await enhancedHybridCacheService.performPredictiveWarming()
    }
    
    // Log performance metrics
    console.log(`📊 Cache Status: ${stats.hitRates.redis.toFixed(1)}% hit rate, ${stats.capacity.redisSize} properties cached`)
    
  } catch (error) {
    console.error('❌ Auto-warming failed:', error.message)
  }
}

// Run every 30 minutes
setInterval(autoWarmCache, 30 * 60 * 1000)
autoWarmCache() // Run immediately

export { autoWarmCache }
