import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { categories } from './categories.js';
import { users } from './users.js';

// --- Subcategories ---

export const subcategories = pgTable(
  'subcategories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    body: text('body').notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('subcategories_category_name_uniq').on(table.categoryId, table.name),
    index('subcategories_category_id_idx').on(table.categoryId),
    index('subcategories_display_order_idx').on(table.categoryId, table.displayOrder),
  ]
);

export type Subcategory = typeof subcategories.$inferSelect;
export type NewSubcategory = typeof subcategories.$inferInsert;
