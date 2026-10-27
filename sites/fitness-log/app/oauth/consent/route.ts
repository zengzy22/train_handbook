import { getOwnerAccess } from '../../../lib/owner';
import { approve, consumePending } from '../../../lib/oauth-repository';
import { checkConsentOrigin, oauthFailure, readForm } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const {user,response} = await getOwnerAccess();
  if (!user) return response!;
  try {
    checkConsentOrigin(request);
    const params = await readForm(request), data = await consumePending(params.get('pending') || '',user.userId);
    const url = new URL(data.redirectUri);
    if (params.get('decision') === 'approve') url.searchParams.set('code',await approve(user.userId,data));
    else url.searchParams.set('error','access_denied');
    if (data.state !== null) url.searchParams.set('state',data.state);
    return new Response(null,{status:303,headers:{Location:url.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  } catch (error) { return oauthFailure(error); }
}
