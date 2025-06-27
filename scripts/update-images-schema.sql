-- Update property_images table with missing columns
ALTER TABLE property_images 
ADD COLUMN IF NOT EXISTS file_size_original INTEGER,
ADD COLUMN IF NOT EXISTS file_size_webp INTEGER,
ADD COLUMN IF NOT EXISTS file_size_avif INTEGER,
ADD COLUMN IF NOT EXISTS original_width INTEGER,
ADD COLUMN IF NOT EXISTS original_height INTEGER;

-- Update any existing records to have proper status
UPDATE property_images 
SET processing_status = 'pending' 
WHERE processing_status IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_property_images_status 
ON property_images(processing_status);

-- Show current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'property_images' 
ORDER BY ordinal_position;
