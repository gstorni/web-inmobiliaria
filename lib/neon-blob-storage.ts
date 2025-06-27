// lib/neon-blob-storage.ts

import { neon, type NeonHttpDatabase } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { Client } from "pg"

// Define a type for your database connection.  Adjust as needed based on your ORM.
type Database = NeonHttpDatabase<any> | ReturnType<typeof drizzlePg>

export class NeonBlobStorage {
  private sql: Database

  constructor(connectionString: string, useDrizzle = false, usePg = false) {
    if (useDrizzle) {
      // Example using Drizzle ORM with Neon HTTP
      const client = neon(connectionString)
      this.sql = drizzle(client)
    } else if (usePg) {
      // Example using Drizzle ORM with node-postgres
      const client = new Client({ connectionString })
      client.connect()
      this.sql = drizzlePg(client)
    } else {
      // Default to using the neon function directly
      this.sql = neon(connectionString)
    }
  }

  async uploadFile(fileId: string, data: Buffer): Promise<void> {
    try {
      await this.sql`
        INSERT INTO blob_storage (file_id, data) 
        VALUES (${fileId}, ${data})
        ON CONFLICT (file_id) DO UPDATE SET data = ${data}
      `
    } catch (error) {
      console.error("Error uploading file:", error)
      throw error
    }
  }

  async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      const result = await this.sql`
        SELECT data FROM blob_storage 
        WHERE file_id = ${fileId}
      `

      if (result.length > 0) {
        return result[0].data as Buffer
      } else {
        return null
      }
    } catch (error) {
      console.error("Error downloading file:", error)
      return null
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.sql`
        DELETE FROM blob_storage 
        WHERE file_id = ${fileId}
      `
    } catch (error) {
      console.error("Error deleting file:", error)
      throw error
    }
  }

  async fileExists(fileId: string): Promise<boolean> {
    try {
      const result = await this.sql`
        SELECT 1 FROM blob_storage 
        WHERE file_id = ${fileId} 
        LIMIT 1
      `
      return result.length > 0
    } catch (error) {
      console.error("Error checking file existence:", error)
      return false
    }
  }
}
