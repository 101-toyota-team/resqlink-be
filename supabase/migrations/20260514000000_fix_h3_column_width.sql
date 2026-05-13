-- Fix h3_index column width to support resolution 7 (15 chars) instead of resolution 8 (13 chars)
ALTER TABLE providers ALTER COLUMN h3_index TYPE varchar(15);
