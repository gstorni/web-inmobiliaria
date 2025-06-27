-- Create Supabase schema for property caching and image optimization
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Properties cache table
CREATE TABLE IF NOT EXISTS properties_cache (
  id BIGINT PRIMARY KEY,
  tokko_id BIGINT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  reference_code TEXT,
  description TEXT,
  rich_description TEXT,
  
  -- Pricing (stored as JSONB for flexibility)
  prices JSONB NOT NULL DEFAULT '[]',
  main_price JSONB NOT NULL,
  available_operations TEXT[] DEFAULT '{}',
  
  -- Dimensions (use NUMERIC instead of DECIMAL)
  surface NUMERIC(10,2) DEFAULT 0,
  covered_surface NUMERIC(10,2) DEFAULT 0,
  uncovered_surface NUMERIC(10,2) DEFAULT 0,
  total_surface NUMERIC(10,2) DEFAULT 0,
  
  -- Location
  location_name TEXT,
  location_full TEXT,
  location_short TEXT,
  address TEXT,
  real_address TEXT,
  coordinates POINT, -- PostGIS point for lat/lng
  
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
  amenities TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  extra_attributes JSONB DEFAULT '[]',
  
  -- Contact info
  contact_info JSONB NOT NULL DEFAULT '{}',
  
  -- Status
  featured BOOLEAN DEFAULT FALSE,
  status INTEGER DEFAULT 0,
  transaction_requirements TEXT,
  has_temporary_rent BOOLEAN DEFAULT FALSE,
  expenses NUMERIC(10,2) DEFAULT 0,
  
  -- URLs and references
  public_url TEXT,
  
  -- Cache metadata
  tokko_created_at TIMESTAMPTZ,
  tokko_updated_at TIMESTAMPTZ,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending', 'error'
  
  -- Search optimization
  search_vector tsvector,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimized images table
CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id BIGINT REFERENCES properties_cache(id) ON DELETE CASCADE,
  
  -- Original image info
  original_url TEXT NOT NULL,
  original_description TEXT,
  display_order INTEGER DEFAULT 0,
  
  -- Optimized versions stored in Supabase Storage
  webp_url TEXT, -- WebP version
  avif_url TEXT, -- AVIF version (most modern)
  thumbnail_url TEXT, -- Small thumbnail
  
  -- Image metadata
  original_width INTEGER,
  original_height INTEGER,
  file_size_original INTEGER,
  file_size_webp INTEGER,
  file_size_avif INTEGER,
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property search index for full-text search
CREATE INDEX IF NOT EXISTS idx_properties_search 
ON properties_cache USING GIN(search_vector);

-- Spatial index for location-based queries
CREATE INDEX IF NOT EXISTS idx_properties_location 
ON properties_cache USING GIST(coordinates);

-- Performance indexes (corrected syntax for Supabase)
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties_cache(featured, cached_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties_cache(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_operation ON properties_cache(operation_type);
CREATE INDEX IF NOT EXISTS idx_properties_surface ON properties_cache(surface);
-- Fixed: Use NUMERIC instead of DECIMAL for casting
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties_cache(CAST(main_price->>'price' AS NUMERIC));
CREATE INDEX IF NOT EXISTS idx_properties_sync_status ON properties_cache(sync_status, last_synced_at);

-- Image indexes
CREATE INDEX IF NOT EXISTS idx_images_property ON property_images(property_id, display_order);
CREATE INDEX IF NOT EXISTS idx_images_processing ON property_images(processing_status);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_properties_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('spanish', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.location_name, '')), 'C') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.address, '')), 'C') ||
    setweight(to_tsvector('spanish', COALESCE(array_to_string(NEW.amenities, ' '), '')), 'D');
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
DROP TRIGGER IF EXISTS trigger_update_properties_search ON properties_cache;
CREATE TRIGGER trigger_update_properties_search
  BEFORE INSERT OR UPDATE ON properties_cache
  FOR EACH ROW EXECUTE FUNCTION update_properties_search_vector();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_properties_updated_at ON properties_cache;
CREATE TRIGGER trigger_update_properties_updated_at
  BEFORE UPDATE ON properties_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_images_updated_at ON property_images;
CREATE TRIGGER trigger_update_images_updated_at
  BEFORE UPDATE ON property_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for optimized images (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true);

-- RLS Policies (if needed)
ALTER TABLE properties_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access" ON properties_cache FOR SELECT USING (true);
CREATE POLICY "Public read access" ON property_images FOR SELECT USING (true);

-- Create a view for easy querying with images
CREATE OR REPLACE VIEW properties_with_images AS
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
        'order', i.display_order
      ) ORDER BY i.display_order
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::json
  ) AS images
FROM properties_cache p
LEFT JOIN property_images i ON p.id = i.property_id
GROUP BY p.id;
