-- Fix the properties_cache table schema
-- Drop and recreate with proper auto-increment and constraints

-- First, drop the existing tables if they exist
DROP TABLE IF EXISTS property_images CASCADE;
DROP TABLE IF EXISTS properties_cache CASCADE;
DROP VIEW IF EXISTS properties_with_images CASCADE;

-- Create the main properties cache table with proper ID handling
CREATE TABLE properties_cache (
    id BIGSERIAL PRIMARY KEY,
    tokko_id INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    reference_code TEXT,
    description TEXT,
    rich_description TEXT,
    prices JSONB DEFAULT '[]'::jsonb,
    main_price JSONB,
    available_operations TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Dimensions
    surface DECIMAL(10,2) DEFAULT 0,
    covered_surface DECIMAL(10,2) DEFAULT 0,
    uncovered_surface DECIMAL(10,2) DEFAULT 0,
    total_surface DECIMAL(10,2) DEFAULT 0,
    
    -- Location
    location_name TEXT,
    location_full TEXT,
    location_short TEXT,
    address TEXT,
    real_address TEXT,
    coordinates POINT,
    
    -- Property details
    property_type TEXT,
    property_type_code TEXT,
    operation_type TEXT,
    age INTEGER,
    condition TEXT,
    situation TEXT,
    zonification TEXT,
    
    -- Room details
    rooms INTEGER DEFAULT 0,
    bathrooms INTEGER DEFAULT 0,
    toilets INTEGER DEFAULT 0,
    suites INTEGER DEFAULT 0,
    parking_spaces INTEGER DEFAULT 0,
    floors INTEGER DEFAULT 1,
    
    -- Features
    orientation TEXT,
    amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    extra_attributes JSONB DEFAULT '[]'::jsonb,
    
    -- Contact
    contact_info JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    featured BOOLEAN DEFAULT FALSE,
    status INTEGER DEFAULT 0,
    transaction_requirements TEXT,
    has_temporary_rent BOOLEAN DEFAULT FALSE,
    expenses DECIMAL(10,2) DEFAULT 0,
    
    -- URLs
    public_url TEXT,
    
    -- Timestamps
    tokko_created_at TIMESTAMPTZ,
    tokko_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'pending'
);

-- Create property images table
CREATE TABLE property_images (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL REFERENCES properties_cache(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    original_description TEXT DEFAULT '',
    display_order INTEGER DEFAULT 0,
    
    -- Optimized versions
    webp_url TEXT,
    avif_url TEXT,
    thumbnail_url TEXT,
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    
    -- File info
    original_size INTEGER,
    optimized_size INTEGER,
    width INTEGER,
    height INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    UNIQUE(property_id, original_url)
);

-- Create indexes for better performance
CREATE INDEX idx_properties_tokko_id ON properties_cache(tokko_id);
CREATE INDEX idx_properties_featured ON properties_cache(featured) WHERE featured = TRUE;
CREATE INDEX idx_properties_operation ON properties_cache(operation_type);
CREATE INDEX idx_properties_type ON properties_cache(property_type_code);
CREATE INDEX idx_properties_surface ON properties_cache(surface);
CREATE INDEX idx_properties_location ON properties_cache(location_name);
CREATE INDEX idx_properties_sync_status ON properties_cache(sync_status);
CREATE INDEX idx_properties_last_synced ON properties_cache(last_synced_at);

-- Price index (handle potential null values)
CREATE INDEX idx_properties_price ON properties_cache 
USING btree (CAST(main_price->>'price' AS NUMERIC))
WHERE main_price IS NOT NULL AND main_price->>'price' IS NOT NULL;

-- Spatial index for coordinates
CREATE INDEX idx_properties_coordinates ON properties_cache USING GIST(coordinates)
WHERE coordinates IS NOT NULL;

-- Full-text search index
ALTER TABLE properties_cache ADD COLUMN search_vector tsvector;

CREATE INDEX idx_properties_search ON properties_cache USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_properties_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('spanish', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.location_name, '')), 'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.address, '')), 'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.property_type, '')), 'D') ||
        setweight(to_tsvector('spanish', array_to_string(NEW.amenities, ' ')), 'D');
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
CREATE TRIGGER trigger_update_properties_search_vector
    BEFORE INSERT OR UPDATE ON properties_cache
    FOR EACH ROW EXECUTE FUNCTION update_properties_search_vector();

-- Image indexes
CREATE INDEX idx_images_property_id ON property_images(property_id);
CREATE INDEX idx_images_status ON property_images(processing_status);
CREATE INDEX idx_images_order ON property_images(property_id, display_order);

-- Create view for properties with images
CREATE VIEW properties_with_images AS
SELECT 
    p.*,
    COALESCE(
        json_agg(
            json_build_object(
                'id', i.id,
                'original_url', i.original_url,
                'webp_url', i.webp_url,
                'avif_url', i.avif_url,
                'thumbnail_url', i.thumbnail_url,
                'description', i.original_description,
                'display_order', i.display_order,
                'processing_status', i.processing_status
            ) ORDER BY i.display_order
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::json
    ) as images
FROM properties_cache p
LEFT JOIN property_images i ON p.id = i.property_id
GROUP BY p.id;

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE properties_cache ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed)
-- GRANT ALL ON properties_cache TO authenticated;
-- GRANT ALL ON property_images TO authenticated;
-- GRANT USAGE ON SEQUENCE properties_cache_id_seq TO authenticated;
-- GRANT USAGE ON SEQUENCE property_images_id_seq TO authenticated;

-- Insert some test data to verify the schema works
-- This will be removed after testing
INSERT INTO properties_cache (
    tokko_id, 
    title, 
    description, 
    main_price, 
    surface, 
    location_name, 
    property_type, 
    operation_type,
    featured
) VALUES (
    999999,
    'Test Property',
    'This is a test property to verify the schema works correctly',
    '{"price": 100000, "currency": "USD", "operation": "Venta"}'::jsonb,
    100.50,
    'Test Location',
    'Industrial',
    'Venta',
    true
);

-- Verify the test insert worked
SELECT id, tokko_id, title, featured FROM properties_cache WHERE tokko_id = 999999;
