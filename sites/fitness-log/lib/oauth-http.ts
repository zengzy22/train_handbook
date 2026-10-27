import { z } from 'zod';
import { siteOrigin, ownerId } from './owner';
import { OAuthError } from './oauth-contract';
import { rateLimit } from './oauth-repository';

export const oauthJson = (body: unknown, status = 200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache','Access-Control-Allow-Origin':'*'}});
export const oauthOptions = () => new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, MCP-Protocol-Version','Access-Control-Max-Age':'600'}});
export const resourceUrl = () => siteOrigin() + '/agent/mcp';
export function requireOwnerConfiguration() { const id = ownerId(); if (!id) throw new OAuthError('temporarily_unavailable','所有者尚未配置',503); return id; }
export async function limitedRequest(request: Request, category: string, max = 30) {
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  await rateLimit(`${category}:${clientIp}`,max);
}
export async function readSmallBody(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 16384) throw new OAuthError('invalid_request','请求过大',413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 16384) throw new OAuthError('invalid_request','请求过大',413);
  return text;
}
export async function readForm(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new OAuthError('invalid_request','需要表单编码请求',415);
  const params = new URLSearchParams(await readSmallBody(request));
  const seen = new Set<string>();
  for (const key of params.keys()) { if (seen.has(key)) throw new OAuthError('invalid_request','参数不能重复'); seen.add(key); }
  return params;
}
export function oauthFailure(error: unknown) {
  if (error instanceof OAuthError) return oauthJson({error:error.code,error_description:error.description},error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return oauthJson({error:'invalid_request',error_description:'参数无效'},400);
  return oauthJson({error:'server_error',error_description:'授权服务暂时不可用'},500);
}
export function checkConsentOrigin(request: Request) {
  if (request.headers.get('origin') !== siteOrigin()) throw new OAuthError('invalid_request','不允许跨站授权操作',403);
}
