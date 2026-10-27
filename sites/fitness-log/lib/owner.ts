import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { ownerAccessStatus } from './owner-access';

export function ownerId() { return (env as unknown as {REPNOTE_OWNER_ID?: string}).REPNOTE_OWNER_ID?.trim(); }
export function siteOrigin() {
  const value = (env as unknown as {REPNOTE_ORIGIN?: string}).REPNOTE_ORIGIN;
  if (!value) throw new Error('REPNOTE_ORIGIN is not configured');
  const url = new URL(value);
  if (url.origin !== value || (url.protocol !== 'https:' && !['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('Invalid REPNOTE_ORIGIN');
  return url.origin;
}
export async function getOwnerAccess() {
  const user = await getChatGPTUser();
  const status = ownerAccessStatus(user?.userId, ownerId());
  return {user:status === 200 ? user : null,response:status === 200 ? null : Response.json({error:status === 401 ? '请先登录' : status === 403 ? '仅站点所有者可访问' : '站点所有者尚未配置'},{status,headers:{'Cache-Control':'no-store'}})};
}
