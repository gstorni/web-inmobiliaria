-- Create processing checkpoints table
CREATE TABLE IF NOT EXISTS processing_checkpoints (
    id SERIAL PRIMARY KEY,
    process_type VARCHAR(50) NOT NULL,
    process_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    current_batch INTEGER NOT NULL DEFAULT 0,
    last_processed_id INTEGER,
    last_processed_tokko_id INTEGER,
    checkpoint_data JSONB DEFAULT '{}',
    error_log TEXT[] DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(process_type, process_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_processing_checkpoints_status ON processing_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_processing_checkpoints_type ON processing_checkpoints(process_type);
CREATE INDEX IF NOT EXISTS idx_processing_checkpoints_updated ON processing_checkpoints(updated_at);

-- Create or replace the update checkpoint function
CREATE OR REPLACE FUNCTION update_checkpoint(
    p_process_type VARCHAR(50),
    p_process_id VARCHAR(100),
    p_processed_items INTEGER,
    p_failed_items INTEGER DEFAULT 0,
    p_current_batch INTEGER DEFAULT 0,
    p_last_processed_id INTEGER DEFAULT NULL,
    p_last_processed_tokko_id INTEGER DEFAULT NULL,
    p_checkpoint_data JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO processing_checkpoints (
        process_type,
        process_id,
        processed_items,
        failed_items,
        current_batch,
        last_processed_id,
        last_processed_tokko_id,
        checkpoint_data,
        error_log,
        updated_at
    ) VALUES (
        p_process_type,
        p_process_id,
        p_processed_items,
        p_failed_items,
        p_current_batch,
        p_last_processed_id,
        p_last_processed_tokko_id,
        p_checkpoint_data,
        CASE WHEN p_error_message IS NOT NULL THEN ARRAY[p_error_message] ELSE '{}' END,
        NOW()
    )
    ON CONFLICT (process_type, process_id)
    DO UPDATE SET
        processed_items = EXCLUDED.processed_items,
        failed_items = EXCLUDED.failed_items,
        current_batch = EXCLUDED.current_batch,
        last_processed_id = EXCLUDED.last_processed_id,
        last_processed_tokko_id = EXCLUDED.last_processed_tokko_id,
        checkpoint_data = EXCLUDED.checkpoint_data,
        error_log = CASE 
            WHEN p_error_message IS NOT NULL THEN 
                array_append(processing_checkpoints.error_log, p_error_message)
            ELSE 
                processing_checkpoints.error_log 
        END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create or replace the complete checkpoint function
CREATE OR REPLACE FUNCTION complete_checkpoint(
    p_process_type VARCHAR(50),
    p_process_id VARCHAR(100),
    p_status VARCHAR(20) DEFAULT 'completed'
) RETURNS VOID AS $$
BEGIN
    UPDATE processing_checkpoints 
    SET 
        status = p_status,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE 
        process_type = p_process_type 
        AND process_id = p_process_id;
END;
$$ LANGUAGE plpgsql;
