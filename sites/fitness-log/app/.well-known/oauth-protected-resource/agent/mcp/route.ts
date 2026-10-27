import { siteOrigin } from '../../../../../lib/owner';
import { scopes } from '../../../../../lib/oauth-contract';
import { oauthJson, oauthOptions, resourceUrl } from '../../../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export function GET() { return oauthJson({resource:resourceUrl(),authorization_servers:[siteOrigin()],scopes_supported:scopes,bearer_methods_supported:['header'],resource_name:'Repnote · 训练手记'}); }
export const OPTIONS = oauthOptions;
