import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { oauthClients, oauthCredentials, oauthGrants, oauthPending, oauthRateLimits } from './oauth-schema';
import { ACCESS_SECONDS, REFRESH_SECONDS, digest, randomSecret, OAuthError } from './oauth-contract';
import type { AuthorizationRequest } from './oauth-contract';

const now = () => Math.floor(Date.now()/1000);
export async function registerClient(name: string, redirects: string[]) {
  const client = {id:crypto.randomUUID(),name,redirectUris:JSON.stringify(redirects),createdAt:now()};
  await getDb().insert(oauthClients).values(client);
  return client;
}
export async function getClient(id: string) { return (await getDb().select().from(oauthClients).where(eq(oauthClients.id,id)).limit(1))[0]; }
export async function rateLimit(key: string, max = 30) {
  const bucket = Math.floor(now()/60), id = `${key}:${bucket}`;
  const rows = await getDb().insert(oauthRateLimits).values({key:id,count:1,expiresAt:(bucket+2)*60}).onConflictDoUpdate({target:oauthRateLimits.key,set:{count:sql`${oauthRateLimits.count}+1`}}).returning();
  if (rows[0].count > max) throw new OAuthError('temporarily_unavailable','请求过于频繁，请稍后重试',429);
  // Opportunistic bounded cleanup; no request-time table creation.
  await getDb().delete(oauthRateLimits).where(sql`${oauthRateLimits.key} IN (SELECT key FROM oauth_rate_limits WHERE expires_at < ${now()} LIMIT 100)`);
}
export async function createPending(userId: string, data: AuthorizationRequest) {
  const id = randomSecret();
  await getDb().insert(oauthPending).values({id,userId,payload:JSON.stringify(data),expiresAt:now()+600});
  return id;
}
export async function consumePending(id: string, userId: string) {
  const rows = await getDb().delete(oauthPending).where(and(eq(oauthPending.id,id),eq(oauthPending.userId,userId),gt(oauthPending.expiresAt,now()))).returning();
  if (!rows.length) throw new OAuthError('invalid_request','授权页面已过期或已经使用，请重新连接');
  return JSON.parse(rows[0].payload) as AuthorizationRequest;
}
export async function approve(userId: string, data: AuthorizationRequest) {
  const db = getDb(), id = crypto.randomUUID(), code = randomSecret(), hash = await digest(code);
  await db.batch([
    db.insert(oauthGrants).values({id,userId,clientId:data.clientId,scope:data.scope,createdAt:now()}),
    db.insert(oauthCredentials).values({hash,kind:'code',grantId:id,payload:JSON.stringify(data),expiresAt:now()+300}),
  ]);
  return code;
}
async function activeGrant(id: string) {
  return (await getDb().select().from(oauthGrants).where(and(eq(oauthGrants.id,id),isNull(oauthGrants.revokedAt))).limit(1))[0];
}
async function issuePair(grantId: string) {
  const access = randomSecret(), refresh = randomSecret(), db = getDb(), issued = now();
  await db.batch([
    db.insert(oauthCredentials).values({hash:await digest(access),kind:'access',grantId,payload:'{}',expiresAt:issued+ACCESS_SECONDS}),
    db.insert(oauthCredentials).values({hash:await digest(refresh),kind:'refresh',grantId,payload:'{}',expiresAt:issued+REFRESH_SECONDS}),
  ]);
  return {access_token:access,refresh_token:refresh,token_type:'Bearer',expires_in:ACCESS_SECONDS};
}
export async function exchangeToken(params: URLSearchParams, resource: string, owner: string) {
  const kind = params.get('grant_type') === 'authorization_code' ? 'code' : params.get('grant_type') === 'refresh_token' ? 'refresh' : null;
  if (!kind) throw new OAuthError('unsupported_grant_type','不支持的 grant_type');
  if (params.get('resource') !== resource) throw new OAuthError('invalid_target','资源地址不匹配');
  const secret = params.get(kind === 'code' ? 'code' : 'refresh_token') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new OAuthError('invalid_grant','凭据无效');
  const hash = await digest(secret), db = getDb();
  const row = (await db.select().from(oauthCredentials).where(and(eq(oauthCredentials.hash,hash),eq(oauthCredentials.kind,kind))).limit(1))[0];
  if (!row) throw new OAuthError('invalid_grant','凭据无效或已过期');
  const grant = await activeGrant(row.grantId);
  if (!grant || grant.userId !== owner || grant.clientId !== params.get('client_id')) throw new OAuthError('invalid_grant','凭据无效');
  if (kind === 'refresh' && row.consumedAt !== null) {
    await db.update(oauthGrants).set({revokedAt:now()}).where(eq(oauthGrants.id,row.grantId));
    throw new OAuthError('invalid_grant','刷新凭据已使用，该授权已撤销，请重新连接');
  }
  if (row.expiresAt <= now()) throw new OAuthError('invalid_grant','凭据无效或已过期');
  if (kind === 'code') {
    const data = JSON.parse(row.payload) as AuthorizationRequest, verifier = params.get('code_verifier') || '';
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || await digest(verifier) !== data.challenge || params.get('redirect_uri') !== data.redirectUri) throw new OAuthError('invalid_grant','PKCE 或 redirect_uri 不匹配');
  } else if (params.has('scope') && params.get('scope') !== grant.scope) throw new OAuthError('invalid_scope','刷新时不能更改权限');
  const consumed = await db.update(oauthCredentials).set({consumedAt:now()}).where(and(eq(oauthCredentials.hash,hash),isNull(oauthCredentials.consumedAt))).returning();
  if (!consumed.length) {
    await db.update(oauthGrants).set({revokedAt:now()}).where(eq(oauthGrants.id,row.grantId));
    throw new OAuthError('invalid_grant','凭据已使用，该授权已撤销，请重新连接');
  }
  return {...await issuePair(grant.id),scope:grant.scope};
}
export async function authenticateToken(token: string, owner: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = (await getDb().select().from(oauthCredentials).where(and(eq(oauthCredentials.hash,await digest(token)),eq(oauthCredentials.kind,'access'),gt(oauthCredentials.expiresAt,now()))).limit(1))[0];
  if (!row) return null;
  const grant = await activeGrant(row.grantId);
  return grant?.userId === owner ? grant : null;
}
export async function revokeToken(token: string, clientId: string) {
  const row = (await getDb().select().from(oauthCredentials).where(eq(oauthCredentials.hash,await digest(token))).limit(1))[0];
  if (!row) return;
  await getDb().update(oauthGrants).set({revokedAt:now()}).where(and(eq(oauthGrants.id,row.grantId),eq(oauthGrants.clientId,clientId)));
}
export async function listGrants(userId: string) {
  return getDb().select({id:oauthGrants.id,clientName:oauthClients.name,scope:oauthGrants.scope,createdAt:oauthGrants.createdAt,revokedAt:oauthGrants.revokedAt}).from(oauthGrants).innerJoin(oauthClients,eq(oauthGrants.clientId,oauthClients.id)).where(eq(oauthGrants.userId,userId));
}
export async function revokeGrant(userId: string, id: string) {
  await getDb().update(oauthGrants).set({revokedAt:now()}).where(and(eq(oauthGrants.id,id),eq(oauthGrants.userId,userId)));
}
