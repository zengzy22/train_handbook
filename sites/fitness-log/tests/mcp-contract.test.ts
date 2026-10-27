import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpTools, listedTools, toolScope } from '../lib/mcp-tools.ts';
import { handleMcp, parseRpcEnvelope, bearerUnauthorized, mcpPreflight } from '../lib/mcp-handler.ts';

const identity={userId:'owner',scope:'repnote:read'};
const options={allowedOrigins:['https://repnote.example'],resourceMetadata:'https://repnote.example/.well-known/oauth-protected-resource/agent/mcp'};
function request(body:unknown,headers:Record<string,string>={}) {
  return new Request('https://repnote.example/agent/mcp',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
}
const call=(name:string,args:unknown={})=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
const body=async(response:Response)=>await response.json() as {error:{code:number};result:{protocolVersion:string}};

test('tool schemas come from strict domain inputs, with required idempotency and version fields',()=>{
  assert.equal(mcpTools.length,12);
  for(const tool of mcpTools.filter(t=>t.name.startsWith('create_')||t.name.startsWith('update_'))) {
    const schema=tool.inputSchema as {required?:string[];additionalProperties?:boolean;properties:Record<string,unknown>};
    assert.equal(schema.additionalProperties,false);
    const field=tool.name.includes('workout')?'workout':tool.name.includes('training_plan')?'plan':'metric';
    assert.ok(schema.required?.includes(field));
    assert.ok(schema.required?.includes(tool.name.startsWith('create_')?'requestId':'expectedUpdatedAt'));
    assert.equal('userId' in schema.properties,false);
    assert.equal(tool.annotations.readOnlyHint,false);
    assert.equal(tool.annotations.destructiveHint,tool.name.startsWith('update_'));
    assert.equal(tool.annotations.idempotentHint,tool.name.startsWith('create_'));
  }
});

test('scope visibility is independent for read and write',()=>{
  assert.equal(listedTools('repnote:read').length,6);
  assert.equal(listedTools('repnote:write').length,6);
  assert.equal(listedTools('repnote:read repnote:write').length,12);
  assert.equal(toolScope('list_profiles'),'repnote:read');
  assert.equal(toolScope('create_body_metric'),'repnote:write');
});

test('invalid envelopes are requests, while malformed JSON is a parse error',async()=>{
  for(const value of [null,[],{}, {jsonrpc:'2.0',id:null,method:'ping'}, {jsonrpc:'2.0',id:1,method:'ping',params:null}])assert.throws(()=>parseRpcEnvelope(value));
  let response=await handleMcp(new Request('https://repnote.example/agent/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}),identity,options);
  assert.equal((await body(response)).error.code,-32700);
  response=await handleMcp(request([]),identity,options);
  assert.equal((await body(response)).error.code,-32600);
  response=await handleMcp(request({jsonrpc:'2.0',id:1,method:'missing'}),identity,options);
  assert.equal((await body(response)).error.code,-32601);
  response=await handleMcp(request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'bogus'}}),identity,options);
  assert.equal((await body(response)).error.code,-32602);
});

test('transport enforces scope, origin, version and notification handling',async()=>{
  let response=await handleMcp(request(call('create_body_metric')),identity,options);
  assert.equal(response.status,403);
  assert.match(response.headers.get('WWW-Authenticate')||'',/repnote:write/);
  response=await handleMcp(request({jsonrpc:'2.0',method:'ping'}),identity,options);
  assert.equal(response.status,202);
  response=await handleMcp(request({jsonrpc:'2.0',id:1,method:'ping'},{Origin:'https://evil.example'}),identity,options);
  assert.equal(response.status,403);
  response=await handleMcp(request({jsonrpc:'2.0',id:1,method:'ping'},{'MCP-Protocol-Version':'bad'}),identity,options);
  assert.equal(response.status,400);
  response=await handleMcp(request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}}),identity,options);
  assert.equal((await body(response)).result.protocolVersion,'2025-06-18');
});

test('JSON media type must match exactly and public challenges remain browser-readable',async()=>{
  for(const type of ['application/jsonp','application/jsonevil','text/plain']) {
    const response=await handleMcp(request({jsonrpc:'2.0',id:1,method:'ping'},{'Content-Type':type}),identity,options);
    assert.equal(response.status,415);
  }
  const valid=await handleMcp(request({jsonrpc:'2.0',id:1,method:'ping'},{'Content-Type':'application/json; charset=utf-8'}),identity,options);
  assert.equal(valid.status,200);
  const challenge=bearerUnauthorized(options.resourceMetadata);
  assert.equal(challenge.status,401);assert.equal(challenge.headers.get('Access-Control-Allow-Origin'),'*');
  assert.match(challenge.headers.get('Access-Control-Expose-Headers')||'',/WWW-Authenticate/);
  assert.equal(mcpPreflight().headers.get('Access-Control-Allow-Credentials'),null);
});

test('large chunked JSON bodies are rejected before dispatch',async()=>{
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(250001));controller.close();}});
  const input=new Request('https://repnote.example/agent/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'} as RequestInit);
  assert.equal((await handleMcp(input,identity,options)).status,413);
});
