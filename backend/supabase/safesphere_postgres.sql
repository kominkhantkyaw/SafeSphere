-- PostgreSQL/Supabase Database Schema
-- Converted from MySQL/MariaDB
-- Database: safesphere_digital
-- Generated: December 15, 2025

-- Enable UUID extension (useful for Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- Custom ENUM Types
-- --------------------------------------------------------

-- Drop existing types if they exist (prevents "already exists" errors)
DROP TYPE IF EXISTS severity_level CASCADE;
DROP TYPE IF EXISTS drill_type CASCADE;
DROP TYPE IF EXISTS drill_status CASCADE;
DROP TYPE IF EXISTS urgency_level CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS triage_level CASCADE;
DROP TYPE IF EXISTS inventory_category CASCADE;
DROP TYPE IF EXISTS inventory_status CASCADE;
DROP TYPE IF EXISTS resource_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create ENUM types
CREATE TYPE severity_level AS ENUM ('high', 'moderate', 'low');
CREATE TYPE drill_type AS ENUM ('Fire', 'Evacuation', 'Lockdown');
CREATE TYPE drill_status AS ENUM ('Upcoming', 'Completed');
CREATE TYPE urgency_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE report_status AS ENUM ('pending', 'active', 'resolved', 'approved', 'info_requested');
CREATE TYPE triage_level AS ENUM ('Black', 'Red', 'Yellow', 'Green');
CREATE TYPE inventory_category AS ENUM ('Medical', 'Food', 'Equipment', 'Water');
CREATE TYPE inventory_status AS ENUM ('Good', 'Low', 'Critical');
CREATE TYPE resource_type AS ENUM ('medical', 'fire', 'police', 'shelter');
CREATE TYPE user_role AS ENUM ('Admin', 'Responder', 'Viewer', 'Reporter');

-- --------------------------------------------------------
-- Drop existing tables (prevents "already exists" errors)
-- --------------------------------------------------------

DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS injuries CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS drills CASCADE;
DROP TABLE IF EXISTS incident_reports CASCADE;
DROP TABLE IF EXISTS safety_assets CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS checklist CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- --------------------------------------------------------
-- Table: alerts
-- --------------------------------------------------------

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity severity_level NOT NULL,
  type VARCHAR(50) NOT NULL,
  timestamp VARCHAR(50) NOT NULL
);

-- Sample data for alerts
INSERT INTO alerts (id, title, description, severity, type, timestamp) VALUES
(1, 'Flash Flood Warning', 'Heavy rain expected. Avoid low-lying areas.', 'high', 'flood', '23:05:26'),
(2, 'Heatwave Advisory', 'Stay hydrated and avoid direct sun.', 'moderate', 'heat', '21:35:26');

-- Reset sequence
SELECT setval('alerts_id_seq', (SELECT MAX(id) FROM alerts));

-- --------------------------------------------------------
-- Table: checklist
-- --------------------------------------------------------

CREATE TABLE checklist (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  xp INTEGER DEFAULT 10,
  completed BOOLEAN DEFAULT FALSE
);

-- Sample data for checklist
INSERT INTO checklist (id, title, xp, completed) VALUES
(1, 'Build a basic emergency kit', 10, FALSE),
(2, 'Save local emergency numbers', 8, TRUE);

-- Reset sequence
SELECT setval('checklist_id_seq', (SELECT MAX(id) FROM checklist));

-- --------------------------------------------------------
-- Table: comments
-- --------------------------------------------------------

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL,
  author VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  timestamp VARCHAR(50) NOT NULL,
  role VARCHAR(50) DEFAULT NULL
);

-- --------------------------------------------------------
-- Table: drills
-- --------------------------------------------------------

CREATE TABLE drills (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date VARCHAR(50) NOT NULL,
  type drill_type NOT NULL,
  status drill_status DEFAULT 'Upcoming',
  participants INTEGER DEFAULT 0,
  notes TEXT DEFAULT NULL
);

-- --------------------------------------------------------
-- Table: incident_reports
-- --------------------------------------------------------

CREATE TABLE incident_reports (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  urgency urgency_level DEFAULT 'Medium',
  department VARCHAR(100) DEFAULT 'General',
  description TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status report_status DEFAULT 'pending',
  timestamp VARCHAR(50) NOT NULL,
  structuralDamage VARCHAR(100) DEFAULT NULL,
  estRepairDays INTEGER DEFAULT 0,
  estCost INTEGER DEFAULT 0,
  repeatable BOOLEAN DEFAULT FALSE,
  situationDiscussed BOOLEAN DEFAULT FALSE,
  mitigationPlan TEXT DEFAULT NULL,
  contactPerson VARCHAR(255) DEFAULT NULL,
  contactPhone VARCHAR(50) DEFAULT NULL,
  adminNotes TEXT DEFAULT NULL,
  image TEXT DEFAULT NULL,
  video TEXT DEFAULT NULL,
  audio TEXT DEFAULT NULL
);

-- Sample data for incident_reports
INSERT INTO incident_reports (id, type, urgency, department, description, lat, lng, status, timestamp, structuralDamage, estRepairDays, estCost, repeatable, situationDiscussed, mitigationPlan, contactPerson, contactPhone, adminNotes, image, video, audio) VALUES
(1, 'FLOOD', 'High', 'General', 'Street flooded near the park', 34.05, -118.24, 'pending', '23:33:46', NULL, 0, 0, FALSE, FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Reset sequence
SELECT setval('incident_reports_id_seq', (SELECT MAX(id) FROM incident_reports));

-- --------------------------------------------------------
-- Table: injuries
-- --------------------------------------------------------

CREATE TABLE injuries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  triageLevel triage_level NOT NULL,
  condition_desc VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  timestamp VARCHAR(50) NOT NULL
);

-- --------------------------------------------------------
-- Table: inventory
-- --------------------------------------------------------

CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  item VARCHAR(255) NOT NULL,
  category inventory_category NOT NULL,
  quantity INTEGER DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'Units',
  status inventory_status DEFAULT 'Good',
  location VARCHAR(255) DEFAULT NULL
);

-- --------------------------------------------------------
-- Table: resources
-- --------------------------------------------------------

CREATE TABLE resources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type resource_type NOT NULL,
  address VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  phone VARCHAR(50) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  capacity INTEGER DEFAULT 0,
  occupancy INTEGER DEFAULT 0,
  operatingHours VARCHAR(100) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  contactPerson VARCHAR(255) DEFAULT NULL,
  contactPhone VARCHAR(50) DEFAULT NULL,
  urgency urgency_level DEFAULT 'Low',
  inFloodZone BOOLEAN DEFAULT FALSE
);

-- Sample data for resources
INSERT INTO resources (id, name, type, address, description, phone, lat, lng, capacity, occupancy, operatingHours, notes, contactPerson, contactPhone, urgency, inFloodZone) VALUES
(1, 'City General Hospital', 'medical', '123 Health St', NULL, '555-0123', 34.0522, -118.2437, 500, 420, NULL, NULL, NULL, NULL, 'Critical', FALSE),
(2, 'Fire Station #4', 'fire', '45 Safety Blvd', NULL, '555-0124', 34.0407, -118.2468, 0, 0, NULL, NULL, NULL, NULL, 'High', FALSE);

-- Reset sequence
SELECT setval('resources_id_seq', (SELECT MAX(id) FROM resources));

-- --------------------------------------------------------
-- Table: safety_assets
-- --------------------------------------------------------

CREATE TABLE safety_assets (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  floor VARCHAR(50) DEFAULT NULL,
  building VARCHAR(100) DEFAULT NULL,
  routePoints TEXT DEFAULT NULL,
  color VARCHAR(20) DEFAULT NULL
);

-- --------------------------------------------------------
-- Table: users
-- --------------------------------------------------------

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  role user_role NOT NULL DEFAULT 'Viewer',
  safetyScore INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  phone VARCHAR(50) DEFAULT NULL,
  avatar TEXT DEFAULT NULL,
  bloodType VARCHAR(10) DEFAULT 'Unknown',
  skills TEXT DEFAULT NULL,
  volunteerPoints INTEGER DEFAULT 0,
  permissions TEXT DEFAULT NULL,
  emergencyContactName VARCHAR(255) DEFAULT NULL,
  emergencyContactPhone VARCHAR(50) DEFAULT NULL
);

-- Sample data for users
-- Note: In production, users should be created via Supabase Auth
-- These are example records for testing only
INSERT INTO users (name, email, password, role, safetyScore, xp, phone, avatar, bloodType, skills, volunteerPoints, permissions, emergencyContactName, emergencyContactPhone) VALUES
('Admin User', 'admin@safesphere.app', 'admin', 'Admin', 100, 500, NULL, NULL, 'Unknown', NULL, 0, NULL, NULL, NULL),
('Sarah Connor', 'sarah@safesphere.app', 'password', 'Responder', 90, 1200, NULL, NULL, 'Unknown', NULL, 0, NULL, NULL, NULL);

-- No sequence reset needed for UUID

-- --------------------------------------------------------
-- Indexes (additional to PRIMARY KEY)
-- --------------------------------------------------------

-- Add foreign key constraint for comments
ALTER TABLE comments
  ADD CONSTRAINT fk_comments_report
  FOREIGN KEY (report_id) REFERENCES incident_reports(id)
  ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_incident_reports_status ON incident_reports(status);
CREATE INDEX idx_incident_reports_urgency ON incident_reports(urgency);
CREATE INDEX idx_incident_reports_location ON incident_reports(lat, lng);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_location ON resources(lat, lng);
CREATE INDEX idx_safety_assets_location ON safety_assets(lat, lng);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- --------------------------------------------------------
-- Row Level Security (RLS) for Supabase
-- --------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (customize based on your auth setup)
-- Note: Uncomment and modify these policies based on your authentication needs

-- Public read access to alerts
CREATE POLICY "Public can view alerts"
  ON alerts FOR SELECT
  USING (true);

-- Public read access to resources
CREATE POLICY "Public can view resources"
  ON resources FOR SELECT
  USING (true);

-- Public read access to incident reports
CREATE POLICY "Public can view reports"
  ON incident_reports FOR SELECT
  USING (true);

-- Allow anyone to insert incident reports (adjust based on your needs)
CREATE POLICY "Anyone can create reports"
  ON incident_reports FOR INSERT
  WITH CHECK (true);

-- AUTHENTICATION-BASED POLICIES (uncomment after setting up Supabase Auth):
-- 
-- -- Authenticated users can create incident reports
-- CREATE POLICY "Authenticated users can create reports"
--   ON incident_reports FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
--
-- -- Admin users can update any incident report
-- CREATE POLICY "Admins can update reports"
--   ON incident_reports FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid()
--       AND users.role = 'Admin'
--     )
--   );
--
-- -- Users can view their own profile
-- CREATE POLICY "Users can view own profile"
--   ON users FOR SELECT
--   USING (id = auth.uid());
--
-- -- Only users can update their own profile
-- CREATE POLICY "Users can update own profile"
--   ON users FOR UPDATE
--   USING (id = auth.uid());

-- --------------------------------------------------------
-- Functions and Triggers
-- --------------------------------------------------------

-- Function to update timestamp automatically
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add timestamp columns (for tracking creation and modifications)
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_incident_reports_modtime
  BEFORE UPDATE ON incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_users_modtime
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- --------------------------------------------------------
-- Notes for Supabase Deployment
-- --------------------------------------------------------

-- 1. Copy this SQL and run it in Supabase SQL Editor
-- 2. Adjust RLS policies based on your authentication setup
-- 3. Update auth.uid() references to match your user ID column
-- 4. Consider using UUID instead of SERIAL for primary keys in production
-- 5. Hash passwords using pgcrypto before storing (never store plain text!)
-- 6. Review and customize RLS policies for your security requirements
-- 7. Add additional indexes based on your query patterns

-- To use UUID primary keys (recommended for Supabase):
-- ALTER TABLE table_name ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Migration: Add missing tables and RLS policies for SafeSphere dual-mode (safesphere_postgres)
-- Run this AFTER your existing safesphere_postgres.sql schema.
-- Adds: tutorials, tutorial_progress, learn_items
-- Adds: RLS policies for full CRUD on checklist, drills, alerts, resources, incident_reports

-- --------------------------------------------------------
-- 1. Add missing tables (tutorials, tutorial_progress, learn_items)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS tutorials (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL CHECK (source IN ('YouTube', 'External')),
  url TEXT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tutorial_progress (
  user_id BIGINT NOT NULL,
  completed_ids JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS learn_items (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  type TEXT NOT NULL CHECK (type IN ('guide', 'video', 'resource')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorial_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_items ENABLE ROW LEVEL SECURITY;

-- Policies for new tables
DROP POLICY IF EXISTS "Allow all for tutorials" ON tutorials;
CREATE POLICY "Allow all for tutorials" ON tutorials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for tutorial_progress" ON tutorial_progress;
CREATE POLICY "Allow all for tutorial_progress" ON tutorial_progress FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for learn_items" ON learn_items;
CREATE POLICY "Allow all for learn_items" ON learn_items FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- 2. Add full CRUD policies for existing tables (checklist, drills)
-- --------------------------------------------------------

-- checklist: existing table, add policies if missing
DROP POLICY IF EXISTS "Allow all for checklist" ON checklist;
CREATE POLICY "Allow all for checklist" ON checklist FOR ALL USING (true) WITH CHECK (true);

-- drills: existing table, add policies if missing
DROP POLICY IF EXISTS "Allow all for drills" ON drills;
CREATE POLICY "Allow all for drills" ON drills FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- 3. Add INSERT/UPDATE/DELETE to alerts, resources, incident_reports
-- (Your schema has SELECT only for alerts/resources; incident_reports has SELECT+INSERT)
-- --------------------------------------------------------

-- alerts: add INSERT, UPDATE, DELETE (you have "Public can view alerts" for SELECT)
DROP POLICY IF EXISTS "Allow insert alerts" ON alerts;
CREATE POLICY "Allow insert alerts" ON alerts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update alerts" ON alerts;
CREATE POLICY "Allow update alerts" ON alerts FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete alerts" ON alerts;
CREATE POLICY "Allow delete alerts" ON alerts FOR DELETE USING (true);

-- resources: add INSERT, UPDATE, DELETE (you have "Public can view resources" for SELECT)
DROP POLICY IF EXISTS "Allow insert resources" ON resources;
CREATE POLICY "Allow insert resources" ON resources FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update resources" ON resources;
CREATE POLICY "Allow update resources" ON resources FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete resources" ON resources;
CREATE POLICY "Allow delete resources" ON resources FOR DELETE USING (true);

-- incident_reports: add UPDATE, DELETE (you have SELECT and INSERT)
DROP POLICY IF EXISTS "Allow update reports" ON incident_reports;
CREATE POLICY "Allow update reports" ON incident_reports FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete reports" ON incident_reports;
CREATE POLICY "Allow delete reports" ON incident_reports FOR DELETE USING (true);
