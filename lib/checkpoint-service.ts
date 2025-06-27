import { sql } from "./neon-client"

interface Checkpoint {
  id: string
  process_name: string
  status: string
  progress: number
  total_items: number
  current_item: number
  error_message?: string
  created_at: string
  updated_at: string
  metadata?: any
}

interface ProgressInfo {
  percentage: number
  remaining: number
  estimatedTimeRemaining?: string
  status: string
}

export class CheckpointService {
  async getActiveCheckpoints(): Promise<Checkpoint[]> {
    try {
      const result = await sql`
        SELECT * FROM sync_checkpoints 
        WHERE status IN ('running', 'paused', 'pending')
        ORDER BY created_at DESC
      `
      return result as Checkpoint[]
    } catch (error) {
      console.error("Failed to get active checkpoints:", error)
      return []
    }
  }

  async createCheckpoint(processName: string, totalItems: number, metadata?: any): Promise<string> {
    try {
      const result = await sql`
        INSERT INTO sync_checkpoints (process_name, status, progress, total_items, current_item, metadata)
        VALUES (${processName}, 'pending', 0, ${totalItems}, 0, ${JSON.stringify(metadata || {})})
        RETURNING id
      `
      return result[0].id
    } catch (error) {
      console.error("Failed to create checkpoint:", error)
      throw error
    }
  }

  async updateCheckpoint(id: string, updates: Partial<Checkpoint>): Promise<void> {
    try {
      const setClause = Object.keys(updates)
        .map((key) => `${key} = $${key}`)
        .join(", ")

      await sql`
        UPDATE sync_checkpoints 
        SET ${sql.unsafe(setClause)}, updated_at = NOW()
        WHERE id = ${id}
      `
    } catch (error) {
      console.error("Failed to update checkpoint:", error)
      throw error
    }
  }

  async completeCheckpoint(id: string): Promise<void> {
    try {
      await sql`
        UPDATE sync_checkpoints 
        SET status = 'completed', progress = 100, updated_at = NOW()
        WHERE id = ${id}
      `
    } catch (error) {
      console.error("Failed to complete checkpoint:", error)
      throw error
    }
  }

  async failCheckpoint(id: string, errorMessage: string): Promise<void> {
    try {
      await sql`
        UPDATE sync_checkpoints 
        SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${id}
      `
    } catch (error) {
      console.error("Failed to fail checkpoint:", error)
      throw error
    }
  }

  getProgressInfo(checkpoint: Checkpoint): ProgressInfo {
    const percentage =
      checkpoint.total_items > 0 ? Math.round((checkpoint.current_item / checkpoint.total_items) * 100) : 0

    const remaining = checkpoint.total_items - checkpoint.current_item

    return {
      percentage,
      remaining,
      status: checkpoint.status,
      estimatedTimeRemaining: this.calculateETA(checkpoint),
    }
  }

  private calculateETA(checkpoint: Checkpoint): string {
    if (checkpoint.current_item === 0 || checkpoint.status !== "running") {
      return "Unknown"
    }

    const elapsed = new Date().getTime() - new Date(checkpoint.created_at).getTime()
    const itemsPerMs = checkpoint.current_item / elapsed
    const remainingItems = checkpoint.total_items - checkpoint.current_item
    const remainingMs = remainingItems / itemsPerMs

    const minutes = Math.round(remainingMs / (1000 * 60))

    if (minutes < 1) return "Less than 1 minute"
    if (minutes < 60) return `${minutes} minutes`

    const hours = Math.round(minutes / 60)
    return `${hours} hours`
  }

  async cleanupOldCheckpoints(): Promise<void> {
    try {
      await sql`
        DELETE FROM sync_checkpoints 
        WHERE status IN ('completed', 'failed') 
        AND updated_at < NOW() - INTERVAL '7 days'
      `
    } catch (error) {
      console.error("Failed to cleanup old checkpoints:", error)
    }
  }
}

export const checkpointService = new CheckpointService()
