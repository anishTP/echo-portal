CREATE TYPE content_section AS ENUM ('brand', 'product', 'experience');
ALTER TABLE contents ADD COLUMN section content_section;
CREATE INDEX contents_section_idx ON contents (section);
