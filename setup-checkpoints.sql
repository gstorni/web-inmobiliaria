-- Create processing_checkpoints table
CREATE TABLE IF NOT EXISTS processing_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    process_type VARCHAR(50) NOT NULL,
    process_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    current_batch INTEGER NOT NULL DEFAULT 0,
    last_processed_id BIGINT,
    last_processed_tokko_id BIGINT,
    checkpoint_data JSONB DEFAULT '{}',
    error_log TEXT[] DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(process_type, process_id)
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_checkpoints_status 
ON processing_checkpoints(status);

CREATE INDEX IF NOT EXISTS idx_checkpoints_type_id 
ON processing_checkpoints(process_type, process_id);

CREATE INDEX IF NOT EXISTS idx_checkpoints_updated 
ON processing_checkpoints(updated_at DESC);

-- Verify table creation
SELECT 'Table created successfully!' as message;

-- Show table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'processing_checkpoints'
ORDER BY ordinal_position;