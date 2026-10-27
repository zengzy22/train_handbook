import { ownerId, siteOrigin } from '../../../lib/owner';
import { authenticateToken, getClient } from '../../../lib/oauth-repository';
import { handleMcp, bearerUnauthorized, mcpPreflight } from '../../../lib/mcp-handler';
export const dynamic='force-dynamic';
const metadata=()=>siteOrigin()+'/.well-known/oauth-protected-resource/agent/mcp';
const unauthorized=()=>bearerUnauthorized(metadata());
function withCors(response:Response,origin:string|null) {
  if(!origin)return response;
  response.headers.set('Access-Control-Allow-Origin',origin);
  response.headers.set('Access-Control-Expose-Headers','WWW-Authenticate, MCP-Protocol-Version');
  response.headers.append('Vary','Origin');
  return response;
}
async function authenticate(request:Request) {
  const match=/^Bearer ([A-Za-z0-9_-]+)$/.exec(request.headers.get('authorization')||'');
  const owner=ownerId();
  if(!owner||!match)return null;
  const grant=await authenticateToken(match[1],owner);
  if(!grant)return null;
  const client=await getClient(grant.clientId);
  if(!client)return null;
  let redirects:string[];
  try {redirects=JSON.parse(client.redirectUris);}catch {return null;}
  const allowedOrigins=[siteOrigin(),...redirects.map(uri=>new URL(uri).origin)];
  return {grant,allowedOrigins};
}
export async function POST(request:Request) {
  const auth=await authenticate(request);
  const origin=request.headers.get('origin');
  if(!auth)return unauthorized();
  if(origin&&!auth.allowedOrigins.includes(origin))return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
  return withCors(await handleMcp(request,{userId:auth.grant.userId,scope:auth.grant.scope},{allowedOrigins:auth.allowedOrigins,resourceMetadata:metadata()}),origin);
}
export async function GET(request:Request) {
  const auth=await authenticate(request);
  if(!auth)return unauthorized();
  const origin=request.headers.get('origin');
  if(origin&&!auth.allowedOrigins.includes(origin))return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
  return withCors(new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}}),origin);
}
export function OPTIONS() {return mcpPreflight();}
