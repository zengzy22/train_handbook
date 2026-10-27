import { sqliteTable, text, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export { oauthClients, oauthGrants, oauthCredentials, oauthPending, oauthRateLimits } from '../lib/oauth-schema';
export const records = sqliteTable('records', {
  userId:text('user_id').notNull(), id:text('id').notNull(), kind:text('kind').notNull(),
  payload:text('payload').notNull(), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
  createdVia:text('created_via').$type<'web'|'mcp'>().notNull().default('web'), updatedVia:text('updated_via').$type<'web'|'mcp'>().notNull().default('web'),
  requestId:text('request_id'), createFingerprint:text('create_fingerprint'),
}, t=>[primaryKey({columns:[t.userId,t.id]}),index('records_user_kind').on(t.userId,t.kind),uniqueIndex('records_user_request').on(t.userId,t.requestId)]);
