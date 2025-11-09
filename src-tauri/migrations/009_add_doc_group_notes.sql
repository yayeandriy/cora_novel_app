-- Migration 009: Add notes column to doc_groups
ALTER TABLE doc_groups ADD COLUMN notes TEXT;
