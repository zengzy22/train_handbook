import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const origin=process.env.REPNOTE_TEST_ORIGIN??'http://127.0.0.1:5174';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('OAuth fixtures are local-only');
const owner='local_seedy', clients=[], pendings=[], records=[];
const identity={'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'local@sites.test'};
const resource=origin+'/agent/mcp';
async function json(path,{method='GET',body,headers={},asOwner=false,redirect='follow'}={}){
  const response=await fetch(origin+path,{method,headers:{...(asOwner?identity:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,redirect});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {response,data};
}
async function form(path,params,{asOwner=false,headers={}}={}){
  const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...(asOwner?identity:{}),...headers},body:new URLSearchParams(params),redirect:'manual'});
  return {response,data:await response.json().catch(()=>null)};
}
async function register(){
  const r=await json('/oauth/register',{method:'POST',body:{client_name:'QA disposable OAuth client',redirect_uris:['http://127.0.0.1:9876/callback']}});
  assert.equal(r.response.status,201,JSON.stringify(r.data));clients.push(r.data.client_id);return r.data.client_id;
}
async function authorize(client,scope='repnote:read repnote:write',approve=true){
  const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  const params=new URLSearchParams({client_id:client,response_type:'code',redirect_uri:'http://127.0.0.1:9876/callback',resource,code_challenge:challenge,code_challenge_method:'S256',scope,state:'qa-state'});
  const r=await json('/oauth/authorize?'+params,{asOwner:true});
  assert.equal(r.response.status,200);
  assert.equal(r.response.headers.get('referrer-policy'),'same-origin','Consent forms must preserve Origin without leaking the authorization URL off-site');
  const pending=r.data.match(/name="pending"[^>]*value="([^"]+)"/)?.[1];assert.ok(pending,'Consent form missing: '+String(r.data).slice(0,200));pendings.push(pending);
  for(const origin of ['https://evil.invalid','null',null]){
    assert.equal((await form('/oauth/consent',{pending,decision:'approve'},{asOwner:true,headers:origin?{Origin:origin}:{}})).response.status,403);
  }
  const consent=await form('/oauth/consent',{pending,decision:approve?'approve':'deny'},{asOwner:true,headers:{Origin:origin}});
  assert.equal(consent.response.status,303,JSON.stringify(consent.data));const callback=new URL(consent.response.headers.get('location'));
  assert.equal(callback.searchParams.get('state'),'qa-state');
  return {client_id:client,grant_type:'authorization_code',resource,redirect_uri:'http://127.0.0.1:9876/callback',code:callback.searchParams.get('code'),code_verifier:verifier,callback,pending};
}
async function tokens(client,scope){const data=await authorize(client,scope);const token=await form('/oauth/token',data);assert.equal(token.response.status,200,JSON.stringify(token.data));return token.data;}
async function mcp(token,name,args={}){return json('/agent/mcp',{method:'POST',headers:{Authorization:'Bearer '+token},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});}
const result=r=>JSON.parse(r.data.result.content[0].text).data;
function localSQL(command){execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command],{stdio:'pipe'});}
try{
  const metadata=await json('/.well-known/oauth-protected-resource/agent/mcp');assert.equal(metadata.data.resource,resource);
  const discovery=await json('/.well-known/oauth-authorization-server');assert.equal(discovery.data.issuer,origin);assert.ok(discovery.data.code_challenge_methods_supported.includes('S256'));
  assert.equal((await json('/api/data',{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@sites.test'}})).response.status,403);
  const anon=await json('/agent/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/list'}});assert.equal(anon.response.status,401);assert.ok(anon.response.headers.get('WWW-Authenticate').includes('resource_metadata'));
  const client=await register();
  const denied=await authorize(client,'repnote:read',false);assert.equal(denied.callback.searchParams.get('error'),'access_denied');
  const code=await authorize(client);
  const wrong=await form('/oauth/token',{...code,code_verifier:'x'.repeat(43)});assert.equal(wrong.response.status,400);
  const exchanged=await form('/oauth/token',code);assert.equal(exchanged.response.status,200,JSON.stringify(exchanged.data));
  const all=exchanged.data;
  assert.equal((await mcp(all.access_token,'list_profiles')).response.status,200);
  const readOnly=await tokens(client,'repnote:read');
  const blocked=await mcp(readOnly.access_token,'create_body_metric',{});assert.equal(blocked.response.status,403);assert.ok(blocked.response.headers.get('WWW-Authenticate').includes('repnote:write'));
  const writeOnly=await tokens(client,'repnote:write');assert.equal((await mcp(writeOnly.access_token,'list_profiles')).response.status,403);
  const metric={profileId:'self',date:'2026-10-26',weight:73,bodyFat:null,restingHeartRate:null,source:'manual',notes:'local disposable OAuth fixture'};
  const requestId=crypto.randomUUID();
  const created=await mcp(all.access_token,'create_body_metric',{requestId,metric});assert.equal(created.response.status,200);assert.ok(!created.data.result.isError,JSON.stringify(created.data));const first=result(created);records.push({kind:'metric',id:first.record.id});assert.equal(first.created,true);assert.equal(first.record.createdVia,'mcp');
  const duplicate=result(await mcp(all.access_token,'create_body_metric',{requestId,metric}));assert.equal(duplicate.record.id,first.record.id);assert.equal(duplicate.created,false);
  const changed=await mcp(all.access_token,'update_body_metric',{id:first.record.id,expectedUpdatedAt:first.record.updatedAt,metric:{...metric,weight:74}});assert.equal(result(changed).record.weight,74);
  const retry=result(await mcp(all.access_token,'create_body_metric',{requestId,metric}));assert.equal(retry.record.weight,74);assert.equal(retry.created,false);
  const conflict=await mcp(all.access_token,'update_body_metric',{id:first.record.id,expectedUpdatedAt:first.record.updatedAt,metric});assert.equal(conflict.data.result.isError,true);
  const snapshot=await json('/api/data',{asOwner:true});assert.equal(snapshot.data.metrics.find(m=>m.id===first.record.id).weight,74);
  const expiredHash=createHash('sha256').update(writeOnly.access_token).digest('base64url');localSQL(`UPDATE oauth_credentials SET expires_at=0 WHERE hash='${expiredHash}'`);
  assert.equal((await mcp(writeOnly.access_token,'create_body_metric',{})).response.status,401);
  const refreshed=await form('/oauth/token',{grant_type:'refresh_token',client_id:client,refresh_token:all.refresh_token,resource});assert.equal(refreshed.response.status,200);
  assert.notEqual(refreshed.data.refresh_token,all.refresh_token);
  const oldRefreshHash=createHash('sha256').update(all.refresh_token).digest('base64url');localSQL(`UPDATE oauth_credentials SET expires_at=0 WHERE hash='${oldRefreshHash}'`);
  const replay=await form('/oauth/token',{grant_type:'refresh_token',client_id:client,refresh_token:all.refresh_token,resource});assert.equal(replay.response.status,400);
  assert.equal((await mcp(refreshed.data.access_token,'list_profiles')).response.status,401,'Refresh replay revokes grant');
  const finalTokens=await tokens(client,'repnote:read');
  const grants=await json('/api/agent-grants',{asOwner:true});const grant=grants.data.grants.filter(g=>g.revokedAt===null).at(-1);assert.ok(grant);
  assert.equal((await json('/api/agent-grants',{method:'DELETE',asOwner:true,headers:{Origin:origin},body:{id:grant.id}})).response.status,200);
  assert.equal((await mcp(finalTokens.access_token,'list_profiles')).response.status,401);
  assert.equal((await mcp(readOnly.access_token,'list_profiles')).response.status,200,'Revoking one grant preserves another');
  assert.equal((await form('/oauth/revoke',{client_id:client,token:readOnly.refresh_token})).response.status,200);
  assert.equal((await mcp(readOnly.access_token,'list_profiles')).response.status,401);
  console.log('PASS: discovery, owner-only consent, PKCE, scope, token expiry, refresh rotation/replay, revocation isolation, MCP writes and idempotency.');
}finally{
  for(const record of records)await json('/api/data',{method:'DELETE',asOwner:true,body:record});
  for(const id of clients){assert.match(id,/^[0-9a-f-]{36}$/);localSQL(`DELETE FROM oauth_credentials WHERE grant_id IN (SELECT id FROM oauth_grants WHERE client_id='${id}')`);localSQL(`DELETE FROM oauth_grants WHERE client_id='${id}'`);localSQL(`DELETE FROM oauth_clients WHERE id='${id}'`);}
  for(const id of pendings){assert.match(id,/^[A-Za-z0-9_-]{43}$/);localSQL(`DELETE FROM oauth_pending WHERE id='${id}'`);}
  console.log('Local OAuth/data fixtures removed.');
}
