import { exchangeToken } from '../../../lib/oauth-repository';
import { limitedRequest, oauthFailure, oauthJson, oauthOptions, readForm, requireOwnerConfiguration, resourceUrl } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const owner = requireOwnerConfiguration();
    await limitedRequest(request,'token',60);
    return oauthJson(await exchangeToken(await readForm(request),resourceUrl(),owner));
  } catch (error) { return oauthFailure(error); }
}
export const OPTIONS = oauthOptions;
