-- Add h3_index column for spatial indexing (resolution 7, 15-char hex)
ALTER TABLE providers ADD COLUMN IF NOT EXISTS h3_index varchar(15);
