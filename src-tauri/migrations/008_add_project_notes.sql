-- Migration 008: Add notes column to projects
-- Adds a nullable TEXT column `notes` to store project-level notes.
-- Safe to run multiple times; ALTER TABLE will only add if missing in fresh DB scenario.
ALTER TABLE projects ADD COLUMN notes TEXT;
