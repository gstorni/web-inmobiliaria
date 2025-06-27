import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export class NeonOnlyCacheService {
  private static instance: NeonOnlyCacheService

  static getInstance(): NeonOnlyCacheService {
    if (!NeonOnlyCacheService.instance) {
      NeonOnlyCacheService.instance = new NeonOnlyCacheService()
    }
    return NeonOnlyCacheService.instance
  }

  async getProperty(tokkoId: number) {
    try {
      const result = await sql`
        SELECT * FROM properties_cache 
        WHERE tokko_id = ${tokkoId}
        AND (cached_at > NOW() - INTERVAL '1 hour' OR sync_status = 'synced')
      `

      if (result.length > 0) {
        // Update access tracking
        await sql`
          UPDATE properties_cache 
          SET last_accessed_at = NOW(), access_count = access_count + 1
          WHERE tokko_id = ${tokkoId}
        `

        return {
          data: result[0],
          source: "neon",
          cached: true,
        }
      }

      return null
    } catch (error) {
      console.error("Neon cache get error:", error)
      return null
    }
  }

  async setProperty(tokkoId: number, propertyData: any) {
    try {
      await sql`
        INSERT INTO properties_cache (
          tokko_id, title, description, main_price, surface,
          location_name, property_type_code, operation_type, featured,
          raw_data, cached_at, sync_status
        ) VALUES (
          ${tokkoId}, ${propertyData.title}, ${propertyData.description},
          ${propertyData.main_price}, ${propertyData.surface}, ${propertyData.location_name},
          ${propertyData.property_type_code}, ${propertyData.operation_type}, ${propertyData.featured},
          ${JSON.stringify(propertyData)}, NOW(), 'synced'
        )
        ON CONFLICT (tokko_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          main_price = EXCLUDED.main_price,
          surface = EXCLUDED.surface,
          location_name = EXCLUDED.location_name,
          property_type_code = EXCLUDED.property_type_code,
          operation_type = EXCLUDED.operation_type,
          featured = EXCLUDED.featured,
          raw_data = EXCLUDED.raw_data,
          cached_at = NOW(),
          sync_status = 'synced',
          updated_at = NOW()
      `

      return true
    } catch (error) {
      console.error("Neon cache set error:", error)
      return false
    }
  }

  async searchProperties(filters: any) {
    try {
      const queryHash = this.generateQueryHash(filters)

      // Check if search is cached
      const cachedResult = await sql`
        SELECT result_data, result_count FROM search_cache
        WHERE query_hash = ${queryHash}
        AND expires_at > NOW()
      `

      if (cachedResult.length > 0) {
        // Update access tracking
        await sql`
          UPDATE search_cache 
          SET last_accessed_at = NOW(), access_count = access_count + 1
          WHERE query_hash = ${queryHash}
        `

        return {
          data: cachedResult[0].result_data,
          count: cachedResult[0].result_count,
          source: "neon-search-cache",
          cached: true,
        }
      }

      return null
    } catch (error) {
      console.error("Neon search cache error:", error)
      return null
    }
  }

  async cacheSearchResults(filters: any, results: any[], count: number) {
    try {
      const queryHash = this.generateQueryHash(filters)

      await sql`
        INSERT INTO search_cache (query_hash, query_params, result_data, result_count)
        VALUES (${queryHash}, ${JSON.stringify(filters)}, ${JSON.stringify(results)}, ${count})
        ON CONFLICT (query_hash) DO UPDATE SET
          result_data = EXCLUDED.result_data,
          result_count = EXCLUDED.result_count,
          cached_at = NOW(),
          last_accessed_at = NOW(),
          access_count = search_cache.access_count + 1,
          expires_at = NOW() + INTERVAL '1 hour'
      `

      return true
    } catch (error) {
      console.error("Neon search cache set error:", error)
      return false
    }
  }

  private generateQueryHash(filters: any): string {
    const crypto = require("crypto")
    return crypto.createHash("md5").update(JSON.stringify(filters)).digest("hex")
  }

  async getStats() {
    try {
      const [propertyStats, searchStats, performanceStats] = await Promise.all([
        sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE last_accessed_at > NOW() - INTERVAL '24 hours') as active_24h FROM properties_cache`,
        sql`SELECT COUNT(*) as total, AVG(access_count) as avg_access FROM search_cache WHERE expires_at > NOW()`,
        sql`SELECT metric_type, AVG(metric_value) as avg_value FROM performance_metrics WHERE recorded_at > NOW() - INTERVAL '1 hour' GROUP BY metric_type`,
      ])

      return {
        properties: {
          total: propertyStats[0].total,
          active24h: propertyStats[0].active_24h,
        },
        searches: {
          cached: searchStats[0].total,
          avgAccess: Number.parseFloat(searchStats[0].avg_access || 0),
        },
        performance: performanceStats.reduce((acc, metric) => {
          acc[metric.metric_type] = Number.parseFloat(metric.avg_value)
          return acc
        }, {}),
        redis: {
          connected: false,
          status: "disabled",
        },
      }
    } catch (error) {
      console.error("Stats error:", error)
      return {
        properties: { total: 0, active24h: 0 },
        searches: { cached: 0, avgAccess: 0 },
        performance: {},
        redis: { connected: false, status: "error" },
      }
    }
  }
}

export const neonOnlyCache = NeonOnlyCacheService.getInstance()
