import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const oauthClients = sqliteTable('oauth_clients', {
  id:text('id').primaryKey(), name:text('name').notNull(), redirectUris:text('redirect_uris').notNull(), createdAt:integer('created_at').notNull(),
});
export const oauthGrants = sqliteTable('oauth_grants', {
  id:text('id').primaryKey(), userId:text('user_id').notNull(), clientId:text('client_id').notNull(), scope:text('scope').notNull(), createdAt:integer('created_at').notNull(), revokedAt:integer('revoked_at'),
}, t=>[index('oauth_grants_user').on(t.userId)]);
export const oauthCredentials = sqliteTable('oauth_credentials', {
  hash:text('hash').primaryKey(), kind:text('kind').notNull(), grantId:text('grant_id').notNull(), payload:text('payload').notNull(), expiresAt:integer('expires_at').notNull(), consumedAt:integer('consumed_at'),
}, t=>[index('oauth_credentials_grant').on(t.grantId),index('oauth_credentials_expiry').on(t.expiresAt)]);
export const oauthPending = sqliteTable('oauth_pending', {
  id:text('id').primaryKey(), userId:text('user_id').notNull(), payload:text('payload').notNull(), expiresAt:integer('expires_at').notNull(),
});
export const oauthRateLimits = sqliteTable('oauth_rate_limits', {
  key:text('key').primaryKey(), count:integer('count').notNull(), expiresAt:integer('expires_at').notNull(),
});
