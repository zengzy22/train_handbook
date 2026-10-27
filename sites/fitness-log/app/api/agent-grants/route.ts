import { z } from 'zod';
import { getOwnerAccess } from '../../../lib/owner';
import { listGrants, revokeGrant } from '../../../lib/oauth-repository';
import { checkConsentOrigin, oauthFailure, readSmallBody } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export async function GET() {
  const {user,response} = await getOwnerAccess();
  if (!user) return response!;
  return Response.json({grants:await listGrants(user.userId)},{headers:{'Cache-Control':'no-store'}});
}
export async function DELETE(request: Request) {
  const {user,response} = await getOwnerAccess();
  if (!user) return response!;
  try {
    checkConsentOrigin(request);
    const {id} = z.object({id:z.string().uuid()}).strict().parse(JSON.parse(await readSmallBody(request)));
    await revokeGrant(user.userId,id);
    return Response.json({revoked:true},{headers:{'Cache-Control':'no-store'}});
  } catch (error) { return oauthFailure(error); }
}
