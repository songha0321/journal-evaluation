-- 0003_pii_and_file_url.sql
-- Add fields exposed in the 9기 Google Form export that the original schema didn't carry.
--   authors:     phone, sex (CHECK), birthdate, korean_subject, math_subject, sci1_subject, sci2_subject
--   submissions: file_url (Google Drive link for the uploaded 답안지)

ALTER TABLE authors ADD COLUMN phone           TEXT;
ALTER TABLE authors ADD COLUMN sex             TEXT CHECK (sex IN ('남', '여'));
ALTER TABLE authors ADD COLUMN birthdate       TEXT;  -- ISO YYYY-MM-DD
ALTER TABLE authors ADD COLUMN korean_subject  TEXT;
ALTER TABLE authors ADD COLUMN math_subject    TEXT;
ALTER TABLE authors ADD COLUMN sci1_subject    TEXT;
ALTER TABLE authors ADD COLUMN sci2_subject    TEXT;

ALTER TABLE submissions ADD COLUMN file_url TEXT;
