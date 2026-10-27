import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizationRequest, digest, parseScopes, permits, registrationSchema, validRedirect } from '../lib/oauth-contract.ts';
import { ownerAccessStatus } from '../lib/owner-access.ts';

test('仅明确配置的 owner 可访问，未配置拒绝放行',()=>{
  assert.equal(ownerAccessStatus('owner','owner'),200);
  assert.equal(ownerAccessStatus('other','owner'),403);
  assert.equal(ownerAccessStatus(null,'owner'),401);
  assert.equal(ownerAccessStatus('owner',undefined),503);
});
test('只接受精确注册的回调，HTTPS 或 HTTP loopback，不允许 fragment 和嵌入凭据',()=>{
  assert.equal(validRedirect('https://client.example/callback'),true);
  assert.equal(validRedirect('http://127.0.0.1:5432/callback'),true);
  for(const uri of ['http://external.example/callback','javascript:alert(1)','https://user:pass@client.example/callback','https://client.example/callback#token']) assert.equal(validRedirect(uri),false);
  assert.equal(registrationSchema.safeParse({redirect_uris:['https://client.example/cb'],token_endpoint_auth_method:'client_secret_post'}).success,false);
});
test('OAuth 权限不隐式升级，PKCE 校验采用 RFC7636 测试向量',async()=>{
  assert.equal(await digest('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.equal(parseScopes(null),'repnote:read');
  assert.equal(permits('repnote:read',true),false);
  assert.equal(permits('repnote:write',false),false);
  assert.throws(()=>parseScopes('repnote:admin'));
});
test('授权要求精确资源、S256 和回调，不做任意重定向',()=>{
  const resource='https://site.example/agent/mcp',redirect='https://client.example/cb';
  const params=new URLSearchParams({response_type:'code',client_id:'id',redirect_uri:redirect,resource,code_challenge:'a'.repeat(43),code_challenge_method:'S256',scope:'repnote:read repnote:write',state:'original'});
  assert.equal(authorizationRequest(params,[redirect],resource).state,'original');
  for(const [key,value] of [['resource','https://other.example/agent/mcp'],['redirect_uri','https://client.example/cb/'],['code_challenge_method','plain']]) {
    const invalid=new URLSearchParams(params);invalid.set(key,value);assert.throws(()=>authorizationRequest(invalid,[redirect],resource));
  }
});
