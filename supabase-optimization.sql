-- Supabase Performance Optimization
-- Run this in your Supabase SQL Editor

-- Add performance indexes for checkpoint queries
CREATE INDEX IF NOT EXISTS idx_checkpoints_status_updated
ON processing_checkpoints(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkpoints_process_type_status 
ON processing_checkpoints(process_type, status);

CREATE INDEX IF NOT EXISTS idx_checkpoints_started_at
ON processing_checkpoints(started_at DESC);

-- Clean up old completed records (older than 7 days)
DELETE FROM processing_checkpoints 
WHERE status = 'completed'
AND completed_at < NOW() - INTERVAL '7 days';