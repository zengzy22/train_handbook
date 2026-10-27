import { registrationSchema } from '../../../lib/oauth-contract';
import { registerClient } from '../../../lib/oauth-repository';
import { limitedRequest, oauthFailure, oauthJson, oauthOptions, readSmallBody, requireOwnerConfiguration } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireOwnerConfiguration();
    await limitedRequest(request,'register',10);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return oauthJson({error:'invalid_request'},415);
    const data = registrationSchema.parse(JSON.parse(await readSmallBody(request)));
    const client = await registerClient(data.client_name,data.redirect_uris);
    return oauthJson({client_id:client.id,client_name:client.name,client_id_issued_at:client.createdAt,redirect_uris:data.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']},201);
  } catch (error) { return oauthFailure(error); }
}
export const OPTIONS = oauthOptions;
