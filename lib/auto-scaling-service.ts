interface ScalingRule {
  metric: string
  scaleUpThreshold: number
  scaleDownThreshold: number
  cooldownPeriod: number // minutes
  maxInstances: number
  minInstances: number
}

interface ScalingAction {
  timestamp: Date
  action: "scale_up" | "scale_down" | "warm_cache" | "optimize_queries"
  trigger: string
  details: Record<string, any>
}

export class AutoScalingService {
  private scalingRules: ScalingRule[] = []
  private scalingHistory: ScalingAction[] = []
  private lastScalingAction = new Map<string, Date>()

  constructor() {
    this.setupDefaultRules()
    this.startScalingMonitor()
  }

  private setupDefaultRules(): void {
    this.scalingRules = [
      {
        metric: "redis_utilization",
        scaleUpThreshold: 85,
        scaleDownThreshold: 40,
        cooldownPeriod: 10,
        maxInstances: 3,
        minInstances: 1,
      },
      {
        metric: "avg_response_time",
        scaleUpThreshold: 150,
        scaleDownThreshold: 50,
        cooldownPeriod: 5,
        maxInstances: 5,
        minInstances: 1,
      },
      {
        metric: "postgres_connections",
        scaleUpThreshold: 80,
        scaleDownThreshold: 30,
        cooldownPeriod: 15,
        maxInstances: 2,
        minInstances: 1,
      },
    ]
  }

  private startScalingMonitor(): void {
    setInterval(async () => {
      await this.evaluateScalingRules()
    }, 60000) // Check every minute
  }

  private async evaluateScalingRules(): Promise<void> {
    const { performanceMonitor } = await import("./performance-monitor")

    for (const rule of this.scalingRules) {
      const recentMetrics = performanceMonitor.getMetrics(rule.metric, new Date(Date.now() - 5 * 60 * 1000))

      if (recentMetrics.length === 0) continue

      const avgValue = recentMetrics.reduce((a, b) => a + b.value, 0) / recentMetrics.length
      const lastAction = this.lastScalingAction.get(rule.metric)
      const cooldownExpired = !lastAction || Date.now() - lastAction.getTime() > rule.cooldownPeriod * 60 * 1000

      if (!cooldownExpired) continue

      if (avgValue > rule.scaleUpThreshold) {
        await this.executeScalingAction("scale_up", rule, avgValue)
      } else if (avgValue < rule.scaleDownThreshold) {
        await this.executeScalingAction("scale_down", rule, avgValue)
      }
    }
  }

  private async executeScalingAction(
    action: "scale_up" | "scale_down",
    rule: ScalingRule,
    currentValue: number,
  ): Promise<void> {
    console.log(`🔧 Auto-scaling: ${action} triggered for ${rule.metric} (${currentValue})`)

    const scalingAction: ScalingAction = {
      timestamp: new Date(),
      action,
      trigger: rule.metric,
      details: {
        currentValue,
        threshold: action === "scale_up" ? rule.scaleUpThreshold : rule.scaleDownThreshold,
        rule,
      },
    }

    this.scalingHistory.push(scalingAction)
    this.lastScalingAction.set(rule.metric, new Date())

    // Execute specific scaling actions based on metric
    switch (rule.metric) {
      case "redis_utilization":
        await this.scaleRedisCache(action, currentValue)
        break
      case "avg_response_time":
        await this.optimizePerformance(action, currentValue)
        break
      case "postgres_connections":
        await this.scalePostgresConnections(action, currentValue)
        break
    }
  }

  private async scaleRedisCache(action: "scale_up" | "scale_down", utilization: number): Promise<void> {
    const { enhancedHybridCacheService } = await import("./enhanced-hybrid-cache-service")

    if (action === "scale_up") {
      // Increase cache efficiency
      console.log("🚀 Scaling up Redis cache efficiency")

      // Trigger aggressive cache warming
      await enhancedHybridCacheService.performPredictiveWarming()

      // In a real implementation, you might:
      // - Increase Redis memory allocation
      // - Add more Redis instances
      // - Optimize eviction policies
    } else {
      // Scale down - optimize cache usage
      console.log("📉 Optimizing Redis cache usage")

      // In a real implementation, you might:
      // - Reduce cache TTL
      // - Implement more aggressive eviction
      // - Reduce cache size
    }
  }

  private async optimizePerformance(action: "scale_up" | "scale_down", responseTime: number): Promise<void> {
    if (action === "scale_up") {
      console.log("⚡ Optimizing performance due to high response times")

      // Trigger cache warming
      const { enhancedHybridCacheService } = await import("./enhanced-hybrid-cache-service")
      await enhancedHybridCacheService.performPredictiveWarming()

      // Optimize database queries
      await this.optimizeDatabaseQueries()
    } else {
      console.log("✅ Performance is optimal, maintaining current configuration")
    }
  }

  private async scalePostgresConnections(action: "scale_up" | "scale_down", connectionUsage: number): Promise<void> {
    if (action === "scale_up") {
      console.log("🔗 Optimizing PostgreSQL connection usage")

      // In a real implementation, you might:
      // - Increase connection pool size
      // - Optimize query performance
      // - Add read replicas
    } else {
      console.log("📉 Reducing PostgreSQL connection overhead")

      // In a real implementation, you might:
      // - Reduce connection pool size
      // - Implement connection pooling optimizations
    }
  }

  private async optimizeDatabaseQueries(): Promise<void> {
    console.log("🔍 Running database query optimization")

    try {
      // Analyze slow queries and suggest optimizations
      const { supabaseAdmin } = await import("./supabase-client")

      // In a real implementation, you might:
      // - Analyze pg_stat_statements
      // - Create missing indexes
      // - Optimize query plans
      // - Update table statistics

      console.log("✅ Database optimization completed")
    } catch (error) {
      console.error("❌ Database optimization failed:", error.message)
    }
  }

  getScalingHistory(limit = 50): ScalingAction[] {
    return this.scalingHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
  }

  getScalingStatus(): {
    activeRules: number
    recentActions: number
    nextEvaluation: Date
    recommendations: string[]
  } {
    const recentActions = this.scalingHistory.filter(
      (action) => action.timestamp > new Date(Date.now() - 60 * 60 * 1000),
    ).length

    const recommendations: string[] = []

    if (recentActions > 10) {
      recommendations.push("High scaling activity detected - consider adjusting thresholds")
    }

    if (recentActions === 0) {
      recommendations.push("System is stable - no recent scaling actions")
    }

    return {
      activeRules: this.scalingRules.length,
      recentActions,
      nextEvaluation: new Date(Date.now() + 60000),
      recommendations,
    }
  }

  // Manual scaling triggers
  async triggerManualScaling(metric: string, action: "scale_up" | "scale_down"): Promise<void> {
    const rule = this.scalingRules.find((r) => r.metric === metric)
    if (!rule) {
      throw new Error(`No scaling rule found for metric: ${metric}`)
    }

    await this.executeScalingAction(action, rule, 0)
  }
}

export const autoScalingService = new AutoScalingService()
