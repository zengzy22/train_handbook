import { callMcpTool, listedTools, toolScope, McpToolError } from './mcp-tools.ts';
import type { McpIdentity } from './mcp-tools.ts';
import { permits } from './oauth-contract.ts';

const versions=['2026-07-28','2025-11-25','2025-06-18','2024-11-05'] as const;
const info={name:'Repnote',version:'1.0.0'};
const jsonHeaders={'Cache-Control':'no-store'};
const rpc=(id:string|number|null,body:object,status=200)=>Response.json({jsonrpc:'2.0',id,...body},{status,headers:jsonHeaders});
const failure=(id:string|number|null,code:number,message:string,status=400)=>rpc(id,{error:{code,message}},status);
export type RpcEnvelope={id?:string|number;method:string;params?:Record<string,unknown>};
export function parseRpcEnvelope(value:unknown):RpcEnvelope {
  if(value===null||typeof value!=='object'||Array.isArray(value))throw new McpToolError('INVALID_REQUEST','Invalid Request');
  const v=value as Record<string,unknown>;
  if(v.jsonrpc!=='2.0'||typeof v.method!=='string'||!v.method)throw new McpToolError('INVALID_REQUEST','Invalid Request');
  if('id' in v && !(typeof v.id==='string'||typeof v.id==='number'&&Number.isFinite(v.id)))throw new McpToolError('INVALID_REQUEST','Invalid Request');
  if('params' in v && (v.params===null||typeof v.params!=='object'||Array.isArray(v.params)))throw new McpToolError('INVALID_PARAMS','Invalid params');
  return v as RpcEnvelope;
}
export function allowedOrigin(origin:string|null,allowed:string[]) {return !origin||allowed.includes(origin);}
export type McpHandlerOptions={allowedOrigins:string[];resourceMetadata?:string};
export function bearerUnauthorized(resourceMetadata:string) {
  // This challenge contains public metadata only; successful calls still check the client's registered Origin.
  return new Response(null,{status:401,headers:{'WWW-Authenticate':`Bearer resource_metadata="${resourceMetadata}"`,'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'WWW-Authenticate','Cache-Control':'no-store'}});
}
export function mcpPreflight() {
  // A preflight has no bearer token or client identity. The actual request enforces its registered Origin.
  return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, MCP-Protocol-Version','Access-Control-Max-Age':'600','Cache-Control':'no-store'}});
}
async function readBounded(request:Request) {
  const reader=request.body?.getReader();
  if(!reader)return '';
  const chunks:Uint8Array[]=[];
  let size=0;
  while(true) {
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>250000) {await reader.cancel();throw new McpToolError('REQUEST_TOO_LARGE','Request too large');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}
export async function handleMcp(request:Request,identity:McpIdentity,options:McpHandlerOptions):Promise<Response> {
  if(!allowedOrigin(request.headers.get('origin'),options.allowedOrigins))return new Response(null,{status:403,headers:jsonHeaders});
  if(request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')return new Response(null,{status:415,headers:jsonHeaders});
  const headerVersion=request.headers.get('mcp-protocol-version');
  if(headerVersion&&!versions.includes(headerVersion as typeof versions[number]))return new Response('Unsupported MCP protocol version',{status:400,headers:jsonHeaders});
  if(Number(request.headers.get('content-length')||0)>250000)return new Response('Request too large',{status:413,headers:jsonHeaders});
  let raw:string;
  try {raw=await readBounded(request);}catch(error) {return error instanceof McpToolError&&error.code==='REQUEST_TOO_LARGE'?new Response('Request too large',{status:413,headers:jsonHeaders}):failure(null,-32700,'Parse error');}
  let value:unknown;
  try {value=JSON.parse(raw);}catch {return failure(null,-32700,'Parse error');}
  if(Array.isArray(value))return failure(null,-32600,'Invalid Request');
  let envelope:RpcEnvelope;
  try {envelope=parseRpcEnvelope(value);}catch(error) {
    const id=value&&typeof value==='object'&&!Array.isArray(value)?(value as Record<string,unknown>).id:null;
    return failure(typeof id==='string'||typeof id==='number'&&Number.isFinite(id)?id:null,error instanceof McpToolError&&error.code==='INVALID_PARAMS'?-32602:-32600,error instanceof McpToolError&&error.code==='INVALID_PARAMS'?'Invalid params':'Invalid Request');
  }
  if(envelope.id===undefined)return new Response(null,{status:202,headers:jsonHeaders});
  const {id,method,params}=envelope;
  if(method==='server/discover')return rpc(id,{result:{serverInfo:info,supportedVersions:versions,capabilities:{tools:{}}}});
  if(method==='initialize') {
    const requested=params?.protocolVersion;
    if(typeof requested!=='string'||!versions.includes(requested as typeof versions[number]))return failure(id,-32602,'Invalid params');
    return rpc(id,{result:{protocolVersion:requested,serverInfo:info,capabilities:{tools:{}}}});
  }
  if(method==='ping')return rpc(id,{result:{}});
  if(method==='tools/list')return rpc(id,{result:{tools:listedTools(identity.scope)}});
  if(method!=='tools/call')return failure(id,-32601,'Method not found');
  if(typeof params?.name!=='string'||params.arguments!==undefined&&(params.arguments===null||typeof params.arguments!=='object'||Array.isArray(params.arguments)))return failure(id,-32602,'Invalid params');
  const name=params.name;
  const needed=toolScope(name);
  if(!needed)return failure(id,-32602,'Unknown tool');
  if(!permits(identity.scope,needed==='repnote:write')) {
    const metadata=options.resourceMetadata;
    const challenge=`Bearer${metadata?` resource_metadata="${metadata}",`:''} scope="${needed}"`;
    return new Response(null,{status:403,headers:{...jsonHeaders,'WWW-Authenticate':challenge}});
  }
  try {return rpc(id,{result:await callMcpTool(name,params.arguments??{},identity)});}
  catch(error) {
    if(error instanceof McpToolError&&error.code==='INVALID_ARGUMENTS')return failure(id,-32602,'Invalid params');
    const code=error instanceof McpToolError?error.code:'INTERNAL_ERROR';
    return rpc(id,{result:{isError:true,content:[{type:'text',text:JSON.stringify({code,message:code==='INTERNAL_ERROR'?'工具暂时不可用':error instanceof Error?error.message:'工具暂时不可用'})}]}});
  }
}
