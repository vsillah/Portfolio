-- Add missing product_purchased column to client_projects
-- Stores the name of the purchased product/bundle (e.g. proposal.bundle_name)
ALTER TABLE client_projects ADD COLUMN product_purchased text;
