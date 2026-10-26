import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  userId:text('user_id').notNull(), id:text('id').notNull(), kind:text('kind').notNull(),
  payload:text('payload').notNull(), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
}, t=>[primaryKey({columns:[t.userId,t.id]}),index('records_user_kind').on(t.userId,t.kind)]);
