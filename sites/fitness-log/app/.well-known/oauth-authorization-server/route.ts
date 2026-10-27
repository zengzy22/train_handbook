import { siteOrigin } from '../../../lib/owner';
import { scopes } from '../../../lib/oauth-contract';
import { oauthJson, oauthOptions } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export function GET() {
  const origin = siteOrigin();
  return oauthJson({issuer:origin,authorization_endpoint:origin+'/oauth/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/oauth/register',revocation_endpoint:origin+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],revocation_endpoint_auth_methods_supported:['none'],scopes_supported:scopes});
}
export const OPTIONS = oauthOptions;
