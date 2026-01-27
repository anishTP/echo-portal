-- Custom migration: Immutability trigger for content_versions
-- Prevents UPDATE or DELETE on content_versions rows when the parent content is published.
-- This provides a database-level safety net on top of application-layer enforcement.

CREATE OR REPLACE FUNCTION prevent_published_version_mutation()
RETURNS TRIGGER AS $$
DECLARE
  content_published boolean;
BEGIN
  -- Check if the parent content is published
  SELECT is_published INTO content_published
  FROM contents
  WHERE id = OLD.content_id;

  IF content_published = true THEN
    RAISE EXCEPTION 'Cannot modify or delete versions of published content (content_id: %)', OLD.content_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_versions_immutability_trigger
  BEFORE UPDATE OR DELETE ON content_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_version_mutation();
