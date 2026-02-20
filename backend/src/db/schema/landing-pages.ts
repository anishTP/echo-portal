import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { contentSectionEnum } from './enums.js';
import { branches } from './branches.js';
import { categories } from './categories.js';
import { users } from './users.js';

// --- Section Pages ---
// One editable overview body per section per branch

export const sectionPages = pgTable(
  'section_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    section: contentSectionEnum('section').notNull(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    body: text('body').notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('section_pages_section_branch_uniq').on(table.section, table.branchId),
  ]
);

export type SectionPage = typeof sectionPages.$inferSelect;
export type NewSectionPage = typeof sectionPages.$inferInsert;

// --- Category Pages ---
// One editable overview body per category per branch

export const categoryPages = pgTable(
  'category_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    body: text('body').notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('category_pages_category_branch_uniq').on(table.categoryId, table.branchId),
  ]
);

export type CategoryPage = typeof categoryPages.$inferSelect;
export type NewCategoryPage = typeof categoryPages.$inferInsert;
