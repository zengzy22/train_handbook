import { getOwnerAccess, siteOrigin } from '../../lib/owner';
import { handleMcp } from '../../lib/mcp-handler';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  const access=await getOwnerAccess();
  if(access.response)return access.response;
  return handleMcp(request,{userId:access.user!.userId,displayName:access.user!.fullName??access.user!.displayName,scope:'repnote:read repnote:write'},{allowedOrigins:[siteOrigin()]});
}
export async function GET() {
  const access=await getOwnerAccess();
  if(access.response)return access.response;
  return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
}
