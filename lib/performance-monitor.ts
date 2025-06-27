interface PerformanceMetric {
  timestamp: Date
  metric: string
  value: number
  tags: Record<string, string>
}

interface AlertRule {
  metric: string
  threshold: number
  operator: "gt" | "lt" | "eq"
  duration: number // minutes
  action: "scale" | "alert" | "warm_cache"
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private alerts: AlertRule[] = []
  private readonly MAX_METRICS = 10000

  constructor() {
    this.setupDefaultAlerts()
    this.startMetricsCollection()
  }

  private setupDefaultAlerts(): void {
    this.alerts = [
      {
        metric: "response_time",
        threshold: 100,
        operator: "gt",
        duration: 5,
        action: "warm_cache",
      },
      {
        metric: "redis_hit_rate",
        threshold: 80,
        operator: "lt",
        duration: 10,
        action: "warm_cache",
      },
      {
        metric: "redis_utilization",
        threshold: 90,
        operator: "gt",
        duration: 5,
        action: "scale",
      },
      {
        metric: "error_rate",
        threshold: 5,
        operator: "gt",
        duration: 3,
        action: "alert",
      },
    ]
  }

  recordMetric(metric: string, value: number, tags: Record<string, string> = {}): void {
    this.metrics.push({
      timestamp: new Date(),
      metric,
      value,
      tags,
    })

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS)
    }

    // Check alerts
    this.checkAlerts(metric, value)
  }

  private checkAlerts(metric: string, value: number): void {
    const relevantAlerts = this.alerts.filter((alert) => alert.metric === metric)

    for (const alert of relevantAlerts) {
      const shouldTrigger = this.evaluateAlert(alert, value)

      if (shouldTrigger) {
        this.triggerAlert(alert, value)
      }
    }
  }

  private evaluateAlert(alert: AlertRule, value: number): boolean {
    switch (alert.operator) {
      case "gt":
        return value > alert.threshold
      case "lt":
        return value < alert.threshold
      case "eq":
        return value === alert.threshold
      default:
        return false
    }
  }

  private async triggerAlert(alert: AlertRule, value: number): Promise<void> {
    console.log(`🚨 Alert triggered: ${alert.metric} ${alert.operator} ${alert.threshold} (current: ${value})`)

    switch (alert.action) {
      case "warm_cache":
        await this.triggerCacheWarming()
        break
      case "scale":
        await this.triggerScaling(alert.metric)
        break
      case "alert":
        await this.sendAlert(alert, value)
        break
    }
  }

  private async triggerCacheWarming(): Promise<void> {
    try {
      const { enhancedHybridCacheService } = await import("./enhanced-hybrid-cache-service")
      await enhancedHybridCacheService.performPredictiveWarming()
      console.log("🔥 Automatic cache warming triggered")
    } catch (error) {
      console.error("Failed to trigger cache warming:", error)
    }
  }

  private async triggerScaling(metric: string): Promise<void> {
    console.log(`📈 Auto-scaling triggered for metric: ${metric}`)
    // Implementation would depend on your infrastructure
    // For now, we'll just log and potentially adjust cache size

    if (metric === "redis_utilization") {
      // Could trigger Redis memory increase or cache eviction
      console.log("🔧 Consider increasing Redis memory or optimizing cache eviction")
    }
  }

  private async sendAlert(alert: AlertRule, value: number): Promise<void> {
    // In a real implementation, this would send notifications
    console.log(`📧 Alert: ${alert.metric} threshold exceeded (${value} ${alert.operator} ${alert.threshold})`)
  }

  getMetrics(metric?: string, since?: Date): PerformanceMetric[] {
    let filtered = this.metrics

    if (metric) {
      filtered = filtered.filter((m) => m.metric === metric)
    }

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since)
    }

    return filtered
  }

  getAggregatedMetrics(
    metric: string,
    interval: "minute" | "hour" = "minute",
  ): Array<{
    timestamp: Date
    avg: number
    min: number
    max: number
    count: number
  }> {
    const metrics = this.getMetrics(metric)
    const intervalMs = interval === "minute" ? 60000 : 3600000
    const groups = new Map<number, number[]>()

    // Group metrics by time interval
    for (const metric of metrics) {
      const bucket = Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs
      if (!groups.has(bucket)) {
        groups.set(bucket, [])
      }
      groups.get(bucket)!.push(metric.value)
    }

    // Calculate aggregations
    return Array.from(groups.entries())
      .map(([timestamp, values]) => ({
        timestamp: new Date(timestamp),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(async () => {
      try {
        const { enhancedHybridCacheService } = await import("./enhanced-hybrid-cache-service")
        const stats = enhancedHybridCacheService.getEnhancedStats()

        // Record key metrics
        this.recordMetric("redis_hit_rate", stats.hitRates.redis, { source: "redis" })
        this.recordMetric("postgres_hit_rate", stats.hitRates.postgres, { source: "postgres" })
        this.recordMetric("search_cache_hit_rate", stats.hitRates.searchCache, { source: "search" })
        this.recordMetric("avg_response_time", stats.performance.avgResponseTime, { source: "system" })
        this.recordMetric("redis_utilization", stats.capacity.redisUtilization, { source: "redis" })
        this.recordMetric("total_requests", stats.performance.totalRequests, { source: "system" })

        // Calculate error rate
        const totalErrors = stats.errors.redis + stats.errors.postgres + stats.errors.api
        const errorRate =
          stats.performance.totalRequests > 0 ? (totalErrors / stats.performance.totalRequests) * 100 : 0
        this.recordMetric("error_rate", errorRate, { source: "system" })
      } catch (error) {
        console.warn("Failed to collect metrics:", error.message)
      }
    }, 30000)
  }

  getSystemHealth(): {
    status: "healthy" | "warning" | "critical"
    score: number
    issues: string[]
    recommendations: string[]
  } {
    const recentMetrics = this.getMetrics(undefined, new Date(Date.now() - 5 * 60 * 1000))
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    // Check response time
    const responseTimes = recentMetrics.filter((m) => m.metric === "avg_response_time")
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b.value, 0) / responseTimes.length
      if (avgResponseTime > 200) {
        issues.push("High response times detected")
        recommendations.push("Consider cache warming or scaling")
        score -= 20
      }
    }

    // Check hit rates
    const redisHitRates = recentMetrics.filter((m) => m.metric === "redis_hit_rate")
    if (redisHitRates.length > 0) {
      const avgHitRate = redisHitRates.reduce((a, b) => a + b.value, 0) / redisHitRates.length
      if (avgHitRate < 70) {
        issues.push("Low Redis hit rate")
        recommendations.push("Optimize cache warming strategy")
        score -= 15
      }
    }

    // Check error rates
    const errorRates = recentMetrics.filter((m) => m.metric === "error_rate")
    if (errorRates.length > 0) {
      const avgErrorRate = errorRates.reduce((a, b) => a + b.value, 0) / errorRates.length
      if (avgErrorRate > 2) {
        issues.push("Elevated error rate")
        recommendations.push("Investigate error sources")
        score -= 25
      }
    }

    let status: "healthy" | "warning" | "critical" = "healthy"
    if (score < 60) status = "critical"
    else if (score < 80) status = "warning"

    return { status, score, issues, recommendations }
  }
}

export const performanceMonitor = new PerformanceMonitor()
