import { z } from 'zod';

export const scopes = ['repnote:read','repnote:write'] as const;
export const ACCESS_SECONDS = 3600;
export const REFRESH_SECONDS = 30 * 86400;
export class OAuthError extends Error {
  code: string;
  description: string;
  status: number;
  constructor(code: string, description: string, status = 400) { super(description); this.code=code; this.description=description; this.status=status; }
}
export const registrationSchema = z.object({
  client_name:z.string().trim().min(1).max(100).default('MCP 客户端'),
  redirect_uris:z.array(z.string().url().max(2048).refine(validRedirect)).min(1).max(8),
  token_endpoint_auth_method:z.literal('none').default('none'),
  grant_types:z.array(z.enum(['authorization_code','refresh_token'])).optional(),
  response_types:z.array(z.literal('code')).optional(),
}).passthrough();
export function validRedirect(value: string) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash && (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)));
  } catch { return false; }
}
export function parseScopes(value: string | null) {
  const requested = [...new Set((value || 'repnote:read').split(' ').filter(Boolean))];
  if (!requested.length || requested.some(s=>!scopes.includes(s as typeof scopes[number]))) throw new OAuthError('invalid_scope','请求了不支持的权限');
  return requested.sort().join(' ');
}
export function permits(scope: string, write: boolean) { return scope.split(' ').includes(write ? 'repnote:write' : 'repnote:read'); }
export async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export function authorizationRequest(params: URLSearchParams, redirects: string[], resource: string) {
  const redirectUri = params.get('redirect_uri') || '';
  // Validate before using this URI for any response, including error redirects.
  if (!redirects.includes(redirectUri)) throw new OAuthError('invalid_request','redirect_uri 未注册');
  if (params.get('response_type') !== 'code') throw new OAuthError('unsupported_response_type','仅支持 authorization code');
  if (params.get('resource') !== resource) throw new OAuthError('invalid_target','资源地址不匹配');
  const challenge = params.get('code_challenge') || '';
  if (params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new OAuthError('invalid_request','需要 PKCE S256');
  const state = params.get('state');
  if (state !== null && state.length > 2048) throw new OAuthError('invalid_request','state 过长');
  return {clientId:params.get('client_id') || '',redirectUri,resource,challenge,state,scope:parseScopes(params.get('scope'))};
}
export type AuthorizationRequest = ReturnType<typeof authorizationRequest>;
