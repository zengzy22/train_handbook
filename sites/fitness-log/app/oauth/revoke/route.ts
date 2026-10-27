import { revokeToken } from '../../../lib/oauth-repository';
import { limitedRequest, oauthFailure, oauthOptions, readForm, oauthJson } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    await limitedRequest(request,'revoke',60);
    const params = await readForm(request), token = params.get('token') || '', clientId = params.get('client_id') || '';
    if (token.length < 256 && clientId.length < 256) await revokeToken(token,clientId);
    return oauthJson({});
  } catch (error) { return oauthFailure(error); }
}
export const OPTIONS = oauthOptions;
