import { neon } from "@neondatabase/serverless"

// Create Neon SQL client
const sql = neon(process.env.DATABASE_URL!)

export { sql }

// Connection pool for better performance
export class NeonConnectionPool {
  private static instance: NeonConnectionPool
  private sql: any

  static getInstance(): NeonConnectionPool {
    if (!NeonConnectionPool.instance) {
      NeonConnectionPool.instance = new NeonConnectionPool()
    }
    return NeonConnectionPool.instance
  }

  constructor() {
    this.sql = neon(process.env.DATABASE_URL!)
  }

  async executeQuery(query: string, params: any[] = []): Promise<any> {
    // For Neon, we need to use tagged template literals
    // Convert parameterized query to template literal format
    if (params.length === 0) {
      return this.sql.unsafe(query)
    }

    // Build the query with parameters
    let processedQuery = query
    params.forEach((param, index) => {
      const placeholder = `$${index + 1}`
      const value =
        param === null
          ? "NULL"
          : typeof param === "string"
            ? `'${param.replace(/'/g, "''")}'`
            : typeof param === "boolean"
              ? param
              : typeof param === "object"
                ? `'${JSON.stringify(param).replace(/'/g, "''")}'`
                : param
      processedQuery = processedQuery.replace(placeholder, value)
    })

    return this.sql.unsafe(processedQuery)
  }

  // Direct tagged template method
  async query(strings: TemplateStringsArray, ...values: any[]): Promise<any> {
    return this.sql(strings, ...values)
  }

  getStats() {
    return {
      activeConnections: 1,
      maxConnections: 1,
    }
  }
}

export const neonPool = NeonConnectionPool.getInstance()
