-- Neon Cache Schema for Industrial Real Estate
-- This replaces Supabase for primary caching

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Properties cache table (main cache)
CREATE TABLE IF NOT EXISTS properties_cache (
    id SERIAL PRIMARY KEY,
    tokko_id INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    rich_description TEXT,
    reference_code TEXT,
    
    -- Pricing information
    prices JSONB DEFAULT '[]',
    main_price JSONB,
    currency TEXT DEFAULT 'USD',
    available_operations TEXT[] DEFAULT '{}',
    
    -- Property details
    surface DECIMAL(10,2) DEFAULT 0,
    covered_surface DECIMAL(10,2) DEFAULT 0,
    uncovered_surface DECIMAL(10,2) DEFAULT 0,
    total_surface DECIMAL(10,2) DEFAULT 0,
    
    -- Location data
    location_name TEXT,
    location_full TEXT,
    location_short TEXT,
    address TEXT,
    real_address TEXT,
    neighborhood TEXT,
    coordinates JSONB, -- {lat: number, lng: number}
    
    -- Property classification
    property_type TEXT,
    property_type_code TEXT,
    operation_type TEXT DEFAULT 'Venta',
    
    -- Property characteristics
    age INTEGER,
    condition TEXT,
    situation TEXT,
    zonification TEXT,
    rooms INTEGER DEFAULT 0,
    bathrooms INTEGER DEFAULT 0,
    toilets INTEGER DEFAULT 0,
    suites INTEGER DEFAULT 0,
    parking_spaces INTEGER DEFAULT 0,
    floors INTEGER DEFAULT 1,
    orientation TEXT,
    
    -- Features and amenities
    amenities TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    extra_attributes JSONB DEFAULT '[]',
    
    -- Contact and business info
    contact_info JSONB DEFAULT '{}',
    agency_name TEXT,
    agency_phone TEXT,
    agency_email TEXT,
    agency_whatsapp TEXT,
    agent_name TEXT,
    
    -- Status and metadata
    featured BOOLEAN DEFAULT FALSE,
    status INTEGER DEFAULT 1,
    transaction_requirements TEXT,
    has_temporary_rent BOOLEAN DEFAULT FALSE,
    expenses DECIMAL(10,2) DEFAULT 0,
    public_url TEXT,
    
    -- Timestamps
    tokko_created_at TIMESTAMP WITH TIME ZONE,
    tokko_updated_at TIMESTAMP WITH TIME ZONE,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'pending',
    
    -- Cache metadata
    cache_version INTEGER DEFAULT 1,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimized images table for Neon storage
CREATE TABLE IF NOT EXISTS property_images_neon (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties_cache(tokko_id) ON DELETE CASCADE,
    
    -- Original image data
    original_url TEXT NOT NULL,
    original_description TEXT,
    display_order INTEGER DEFAULT 0,
    
    -- Optimized image URLs (stored in Neon or external CDN)
    webp_url TEXT,
    avif_url TEXT,
    thumbnail_url TEXT,
    
    -- Image metadata
    original_width INTEGER,
    original_height INTEGER,
    file_size_original INTEGER,
    file_size_webp INTEGER,
    file_size_avif INTEGER,
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, error
    processing_error TEXT,
    optimization_level TEXT DEFAULT 'standard', -- standard, aggressive, lossless
    
    -- Performance tracking
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_property_image_neon UNIQUE(property_id, original_url)
);

-- Cache performance tracking
CREATE TABLE IF NOT EXISTS cache_performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_type TEXT NOT NULL, -- 'hit', 'miss', 'write', 'eviction'
    cache_layer TEXT NOT NULL, -- 'redis', 'neon', 'api'
    resource_type TEXT NOT NULL, -- 'property', 'image', 'search'
    resource_id TEXT,
    response_time_ms INTEGER,
    data_size_bytes INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hot properties tracking (for Redis cache warming)
CREATE TABLE IF NOT EXISTS hot_properties (
    tokko_id INTEGER PRIMARY KEY REFERENCES properties_cache(tokko_id) ON DELETE CASCADE,
    access_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    heat_score DECIMAL(5,2) DEFAULT 1.0, -- Calculated heat score
    redis_cached BOOLEAN DEFAULT FALSE,
    redis_cached_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search cache for complex queries
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    query_hash TEXT UNIQUE NOT NULL,
    query_params JSONB NOT NULL,
    result_count INTEGER NOT NULL,
    result_ids INTEGER[] NOT NULL,
    cache_hit_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_properties_cache_tokko_id ON properties_cache(tokko_id);
CREATE INDEX IF NOT EXISTS idx_properties_cache_type_code ON properties_cache(property_type_code);
CREATE INDEX IF NOT EXISTS idx_properties_cache_operation ON properties_cache(operation_type);
CREATE INDEX IF NOT EXISTS idx_properties_cache_featured ON properties_cache(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_properties_cache_location ON properties_cache USING GIN(location_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_cache_title ON properties_cache USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_cache_surface ON properties_cache(surface);
CREATE INDEX IF NOT EXISTS idx_properties_cache_price ON properties_cache USING GIN(main_price);
CREATE INDEX IF NOT EXISTS idx_properties_cache_tags ON properties_cache USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_properties_cache_amenities ON properties_cache USING GIN(amenities);
CREATE INDEX IF NOT EXISTS idx_properties_cache_last_accessed ON properties_cache(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_properties_cache_sync_status ON properties_cache(sync_status);

-- Image indexes
CREATE INDEX IF NOT EXISTS idx_property_images_neon_property_id ON property_images_neon(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_neon_status ON property_images_neon(processing_status);
CREATE INDEX IF NOT EXISTS idx_property_images_neon_display_order ON property_images_neon(property_id, display_order);

-- Performance tracking indexes
CREATE INDEX IF NOT EXISTS idx_cache_metrics_type_layer ON cache_performance_metrics(metric_type, cache_layer);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_created_at ON cache_performance_metrics(created_at);

-- Hot properties indexes
CREATE INDEX IF NOT EXISTS idx_hot_properties_heat_score ON hot_properties(heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_hot_properties_last_accessed ON hot_properties(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hot_properties_redis_cached ON hot_properties(redis_cached);

-- Search cache indexes
CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_cache_updated_at 
    BEFORE UPDATE ON properties_cache 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_images_neon_updated_at 
    BEFORE UPDATE ON property_images_neon 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hot_properties_updated_at 
    BEFORE UPDATE ON hot_properties 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate heat score
CREATE OR REPLACE FUNCTION calculate_heat_score(
    access_count INTEGER,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    featured BOOLEAN DEFAULT FALSE
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    time_factor DECIMAL(5,2);
    access_factor DECIMAL(5,2);
    featured_bonus DECIMAL(5,2) := 0;
BEGIN
    -- Time decay factor (more recent = higher score)
    time_factor := GREATEST(0.1, 1.0 - (EXTRACT(EPOCH FROM NOW() - last_accessed_at) / 86400.0 / 7.0)); -- 7 day decay
    
    -- Access count factor (logarithmic scale)
    access_factor := LEAST(10.0, LOG(GREATEST(1, access_count)) + 1);
    
    -- Featured property bonus
    IF featured THEN
        featured_bonus := 2.0;
    END IF;
    
    RETURN ROUND((time_factor * access_factor + featured_bonus)::DECIMAL(5,2), 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update hot properties
CREATE OR REPLACE FUNCTION update_hot_property(property_tokko_id INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO hot_properties (tokko_id, access_count, last_accessed_at, heat_score)
    VALUES (
        property_tokko_id, 
        1, 
        NOW(),
        calculate_heat_score(1, NOW(), (SELECT featured FROM properties_cache WHERE tokko_id = property_tokko_id))
    )
    ON CONFLICT (tokko_id) DO UPDATE SET
        access_count = hot_properties.access_count + 1,
        last_accessed_at = NOW(),
        heat_score = calculate_heat_score(
            hot_properties.access_count + 1, 
            NOW(),
            (SELECT featured FROM properties_cache WHERE tokko_id = property_tokko_id)
        );
        
    -- Also update the main properties cache access tracking
    UPDATE properties_cache 
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE tokko_id = property_tokko_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS VOID AS $$
BEGIN
    DELETE FROM cache_performance_metrics 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    DELETE FROM search_cache 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled cleanup job (if pg_cron is available)
-- SELECT cron.schedule('cleanup-cache-metrics', '0 2 * * *', 'SELECT cleanup_old_metrics();');
