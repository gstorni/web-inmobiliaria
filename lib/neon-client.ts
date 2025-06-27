import { neon } from "@neondatabase/serverless"

// Create Neon SQL client using tagged template literals
const sql = neon(process.env.DATABASE_URL!)

export { sql }

// Simple connection wrapper for compatibility
export class NeonConnectionPool {
  private static instance: NeonConnectionPool

  static getInstance(): NeonConnectionPool {
    if (!NeonConnectionPool.instance) {
      NeonConnectionPool.instance = new NeonConnectionPool()
    }
    return NeonConnectionPool.instance
  }

  // Legacy method for backward compatibility - converts to tagged template
  async executeQuery(query: string, params: any[] = []): Promise<any> {
    console.warn("executeQuery is deprecated - use tagged template literals instead")

    // For simple queries without parameters, use directly
    if (params.length === 0) {
      return sql.unsafe(query)
    }

    // For parameterized queries, we need to convert them
    // This is a basic conversion - for complex queries, use tagged templates directly
    let convertedQuery = query
    params.forEach((param, index) => {
      convertedQuery = convertedQuery.replace(`$${index + 1}`, `'${param}'`)
    })

    return sql.unsafe(convertedQuery)
  }

  getStats() {
    return {
      activeConnections: 1,
      maxConnections: 1,
    }
  }
}

export const neonPool = NeonConnectionPool.getInstance()
