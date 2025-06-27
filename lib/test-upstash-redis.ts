import Redis from "ioredis"

export class UpstashRedisService {
  private redis: Redis | null = null
  private connectionStatus: "disconnected" | "connecting" | "connected" | "error" = "disconnected"

  constructor() {
    this.initializeUpstashRedis()
  }

  private async initializeUpstashRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL

    if (!redisUrl) {
      console.log("❌ REDIS_URL not found in environment variables")
      return
    }

    // Validate Upstash URL format
    if (!redisUrl.includes("upstash.io")) {
      console.log("⚠️ Redis URL doesn't appear to be from Upstash")
    }

    console.log("🔄 Initializing Upstash Redis connection...")
    this.connectionStatus = "connecting"

    try {
      // Upstash-optimized configuration
      this.redis = new Redis(redisUrl, {
        connectTimeout: 10000,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        // Upstash requires TLS
        tls: {},
        // Keep connection alive
        keepAlive: 30000,
        // Family 4 for IPv4
        family: 4,
      })

      // Event handlers
      this.redis.on("connect", () => {
        console.log("🔗 Upstash Redis: Connection established")
      })

      this.redis.on("ready", () => {
        console.log("✅ Upstash Redis: Ready and operational")
        this.connectionStatus = "connected"
      })

      this.redis.on("error", (error) => {
        console.error("❌ Upstash Redis error:", error.message)
        this.connectionStatus = "error"
      })

      this.redis.on("close", () => {
        console.log("⚠️ Upstash Redis: Connection closed")
        this.connectionStatus = "disconnected"
      })

      this.redis.on("end", () => {
        console.log("🔚 Upstash Redis: Connection ended")
        this.connectionStatus = "disconnected"
        this.redis = null
      })

      // Test connection
      await this.redis.connect()
      const pingResult = await this.redis.ping()
      
      if (pingResult === "PONG") {
        console.log("✅ Upstash Redis: Connection test successful")
        
        // Test basic operations
        await this.redis.set("upstash-test", "working", "EX", 60)
        const testValue = await this.redis.get("upstash-test")
        
        if (testValue === "working") {
          console.log("✅ Upstash Redis: Read/Write test successful")
          await this.redis.del("upstash-test")
        } else {
          console.log("⚠️ Upstash Redis: Read/Write test failed")
        }
      } else {
        throw new Error(`Invalid ping response: ${pingResult}`)
      }

    } catch (error) {
      console.error("❌ Upstash Redis initialization failed:", error.message)
      this.connectionStatus = "error"
      this.redis = null
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redis || this.connectionStatus !== "connected") {
      return null
    }

    try {
      return await this.redis.get(key)
    } catch (error) {
      console.error("Upstash Redis get error:", error.message)
      return null
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.redis || this.connectionStatus !== "connected") {
      return false
    }

    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value)
      } else {
        await this.redis.set(key, value)
      }
      return true
    } catch (error) {
      console.error("Upstash Redis set error:", error.message)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.redis || this.connectionStatus !== "connected") {
      return false
    }

    try {
      await this.redis.del(key)
      return true
    } catch (error) {
      console.error("Upstash Redis del error:", error.message)
      return false
    }
  }

  getStatus() {
    return {
      connected: this.connectionStatus === "connected",
      status: this.connectionStatus,
      redis: !!this.redis,
    }
  }
}

// Test the service
export const upstashRedis = new UpstashRedisService()
