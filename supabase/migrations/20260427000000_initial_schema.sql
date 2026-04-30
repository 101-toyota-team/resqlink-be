-- 1. Providers Table
CREATE TYPE provider_type AS ENUM ('rumah_sakit', 'klinik', 'komunitas', 'rt_rw', 'yayasan', 'masjid', 'lainnya');

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider_type provider_type NOT NULL,
    logo_url TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Hospitals Table (1-to-1 with Providers)
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    igd_phone VARCHAR(20) NOT NULL,
    igd_email VARCHAR(255),
    bed_capacity INT,
    specializations TEXT[],
    accreditation VARCHAR(100),
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,
    website_url TEXT,
    UNIQUE(provider_id)
);

-- 3. Ambulances Table
CREATE TYPE ambulance_type AS ENUM ('medis', 'sosial', 'jenazah', 'darurat');
CREATE TYPE service_level AS ENUM ('basic', 'advanced', 'icu_mobile');
CREATE TYPE ambulance_status AS ENUM ('available', 'dispatched', 'unavailable', 'maintenance');

CREATE TABLE ambulances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    plate_number VARCHAR(20) NOT NULL,
    ambulance_type ambulance_type NOT NULL,
    service_level service_level NOT NULL,
    equipment TEXT[],
    has_paramedic BOOLEAN NOT NULL DEFAULT FALSE,
    price_base INT, -- Null for sosial
    price_per_km INT, -- Null for sosial
    status ambulance_status NOT NULL DEFAULT 'available',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Drivers Table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    phone VARCHAR(20) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    current_ambulance_id UUID REFERENCES ambulances(id) ON DELETE SET NULL,
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Bookings Table
CREATE TYPE booking_status AS ENUM ('confirmed', 'en_route', 'arrived', 'to_hospital', 'completed', 'cancelled');

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Assuming Supabase Auth handles users
    ambulance_id UUID NOT NULL REFERENCES ambulances(id),
    driver_id UUID REFERENCES drivers(id),
    booking_type ambulance_type NOT NULL,
    patient_condition TEXT NOT NULL,
    needs_paramedic BOOLEAN NOT NULL DEFAULT FALSE,
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10,7) NOT NULL,
    pickup_lng DECIMAL(10,7) NOT NULL,
    pickup_h3 VARCHAR(16) NOT NULL, -- Added as per v1.2
    destination_address TEXT NOT NULL,
    destination_lat DECIMAL(10,7) NOT NULL,
    destination_lng DECIMAL(10,7) NOT NULL,
    estimated_price INT,
    final_price INT,
    status booking_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
