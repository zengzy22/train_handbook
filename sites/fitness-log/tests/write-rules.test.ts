import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationSchema } from '../lib/model.ts';
import { canonicalJSON, nextUpdatedAt, matchCreateRequest } from '../lib/write-rules.ts';
test('create replay uses immutable input after a record moves away from its deleted profile',()=>{
  const fingerprint=canonicalJSON({profileId:'deleted-profile',weight:70});
  const edited={kind:'metric',createFingerprint:fingerprint,payload:{profileId:'self',weight:71}};
  assert.equal(matchCreateRequest(edited,'metric',fingerprint),edited);
  assert.throws(()=>matchCreateRequest(edited,'metric',canonicalJSON({profileId:'self',weight:70})),/IDEMPOTENCY_CONFLICT/);
  assert.throws(()=>matchCreateRequest(edited,'workout',fingerprint),/IDEMPOTENCY_CONFLICT/);
  assert.equal(matchCreateRequest(undefined,'metric',fingerprint),undefined);
});
test('canonical fingerprints ignore object order but preserve arrays and null',()=>{
  assert.equal(canonicalJSON({b:null,a:{y:2,x:1}}),canonicalJSON({a:{x:1,y:2},b:null}));
  assert.notEqual(canonicalJSON([1,2]),canonicalJSON([2,1]));
  assert.notEqual(canonicalJSON({a:null}),canonicalJSON({}));
});
test('versions advance when the clock is equal or behind',()=>{
  const prior='2026-10-26T00:00:00.000Z';
  assert.equal(nextUpdatedAt(prior,new Date(prior)),'2026-10-26T00:00:00.001Z');
  assert.equal(nextUpdatedAt(prior,new Date('2025-01-01')),'2026-10-26T00:00:00.001Z');
});
test('existing domain writes require a version, profile flow stays compatible',()=>{
  const id=crypto.randomUUID();
  assert.equal(mutationSchema.safeParse({kind:'metric',id,data:{}}).success,false);
  assert.equal(mutationSchema.safeParse({kind:'metric',id,data:{},expectedUpdatedAt:'2026-10-26T00:00:00.000Z'}).success,true);
  assert.equal(mutationSchema.safeParse({kind:'profile',id:'self',data:{}}).success,true);
});
