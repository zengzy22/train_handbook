import assert from 'node:assert/strict';
const origin=process.env.REPNOTE_TEST_ORIGIN??'http://127.0.0.1:5174';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Integration fixtures are local-only');
const owner=process.env.REPNOTE_TEST_OWNER??'local_seedy',saved=[];
const fixture='QA '+crypto.randomUUID();
async function call(path,{user=owner,method='GET',body,extraHeaders={}}={}){
  const r=await fetch(origin+path,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':'qa@sites.test'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...extraHeaders},body:body!==undefined?JSON.stringify(body):undefined});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data};
}
const rpc=(method,params={},options={})=>call('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method,params},...options});
const mcp=(name,args={})=>rpc('tools/call',{name,arguments:args});
const result=r=>JSON.parse(r.data.result.content[0].text).data;
async function createProfile(){
  const name=fixture+' profile '+crypto.randomUUID().slice(0,12);
  const r=await call('/api/data',{method:'PUT',body:{kind:'profile',data:{name,birthDate:null,sex:null,heightCm:null,notes:'local fixture'}}});
  assert.equal(r.status,200);const profile=r.data.profiles.find(p=>p.name===name);saved.push({kind:'profile',id:profile.id});return profile.id;
}
const set={id:crypto.randomUUID(),exercise:'QA Bench',muscle:'胸部',weight:60,reps:8,rpe:0,mcv:0.76,completed:true,warmup:false};
try{
  for(const path of ['/api/data','/api/import-plan','/api/agent-grants']){
    assert.equal((await call(path,{user:null})).status,401);
    assert.equal((await call(path,{user:'other-account'})).status,403);
  }
  assert.equal((await rpc('tools/list',{}, {user:null})).status,401);
  assert.equal((await rpc('tools/list',{}, {user:'other-account'})).status,403);
  const profileId=await createProfile();
  const workout={profileId,name:fixture,date:'2026-10-21',durationMinutes:45,calories:null,calorieSource:null,feeling:4,status:'completed',notes:'local disposable fixture',sets:[set]};
  const plan={profileId,name:fixture,description:'target',sets:[{...set,completed:false}]};
  const metric={profileId,date:'2026-10-21',weight:70,bodyFat:null,restingHeartRate:null,source:'manual',notes:fixture};
  for(const [kind,data,key] of [['workout',workout,'workouts'],['plan',plan,'plans'],['metric',metric,'metrics']]){
    const r=await call('/api/data',{method:'PUT',body:{kind,data}});assert.equal(r.status,200);
    const record=r.data[key].find(x=>x.profileId===profileId);assert.ok(record);assert.equal(record.createdVia,'web');saved.push({kind,id:record.id});
  }
  const initial=await call('/api/data');assert.equal(initial.data.schemaVersion,4);
  assert.equal(initial.data.workouts.find(w=>w.profileId===profileId).sets[0].rpe,0);
  for(const [kind,data,tool] of [['workout',workout,'create_workout'],['plan',plan,'create_training_plan']]){
    for(const rpe of [7.3,10.5]){
      const invalid={...data,sets:[{...set,rpe}]};
      assert.equal((await call('/api/data',{method:'PUT',body:{kind,data:invalid}})).status,400);
      const rejected=await mcp(tool,{requestId:crypto.randomUUID(),[kind==='plan'?'plan':'workout']:invalid});
      assert.ok(rejected.data.error||rejected.data.result?.isError,'MCP must reject an invalid RPE');
    }
  }
  const all=result(await mcp('get_all_fitness_data'));assert.deepEqual(all.workouts,initial.data.workouts);assert.deepEqual(all.metrics,initial.data.metrics);
  assert.equal(result(await mcp('get_training_summary',{profileId,from:'2026-10-21',to:'2026-10-21'})).volumeKg,480);
  assert.equal(result(await mcp('list_workouts',{profileId,from:'2026-10-22'})).workouts.length,0);
  assert.equal((await mcp('list_workouts',{from:'2026-11-01',to:'2026-10-01'})).data.error.code,-32602);
  const tools=(await rpc('tools/list')).data.result.tools;assert.equal(tools.length,12);assert.equal(tools.filter(t=>t.annotations.readOnlyHint).length,6);
  assert.ok((await rpc('server/discover')).data.result.supportedVersions.includes('2026-07-28'));
  assert.equal((await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'qa',version:'1'}})).data.result.protocolVersion,'2025-11-25');
  assert.equal((await call('/mcp',{method:'POST',body:null})).status,400);
  assert.equal((await call('/mcp',{method:'POST',body:[]})).status,400);
  assert.equal((await rpc('ping',{}, {extraHeaders:{Origin:'https://external.invalid'}})).status,403);
  assert.equal((await rpc('ping',{}, {extraHeaders:{'MCP-Protocol-Version':'unknown'}})).status,400);
  assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',data:{...workout,date:'2026-02-30'}}})).status,400);
  assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',data:workout},extraHeaders:{Origin:'https://external.invalid'}})).status,403);
  const existing=initial.data.workouts.find(w=>w.profileId===profileId);
  assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',id:existing.id,data:workout}})).status,400);
  assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',id:existing.id,expectedUpdatedAt:existing.updatedAt,data:{...workout,name:fixture+' edited'}}})).status,200);
  assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',id:existing.id,expectedUpdatedAt:existing.updatedAt,data:workout}})).status,409);
  for(const [tool,kind,field,data] of [['workout','workout','workout',workout],['training_plan','plan','plan',plan],['body_metric','metric','metric',metric]]){
    const requestId=crypto.randomUUID(),args={requestId,[field]:data};
    const concurrent=await Promise.all([mcp('create_'+tool,args),mcp('create_'+tool,args)]);
    for(const r of concurrent)assert.ok(!r.data.result.isError,JSON.stringify(r.data));
    const a=result(concurrent[0]),b=result(concurrent[1]);assert.equal(a.record.id,b.record.id);saved.push({kind,id:a.record.id});assert.equal(a.record.createdVia,'mcp');
    const duplicate=result(await mcp('create_'+tool,args));assert.equal(duplicate.record.id,a.record.id);assert.equal(duplicate.created,false);
    assert.equal((await mcp('create_'+tool,{...args,[field]:{...data,...(field==='metric'?{weight:71}:{name:'different'})}})).data.result.isError,true);
    const updated=result(await mcp('update_'+tool,{id:a.record.id,expectedUpdatedAt:a.record.updatedAt,[field]:{...data,...(field==='metric'?{weight:72}:{name:fixture+' mcp edit'})}}));assert.equal(updated.record.updatedVia,'mcp');assert.notEqual(updated.record.updatedAt,a.record.updatedAt);
    assert.equal((await mcp('update_'+tool,{id:a.record.id,expectedUpdatedAt:a.record.updatedAt,[field]:data})).data.result.isError,true);
    const retry=result(await mcp('create_'+tool,args));assert.equal(retry.record.id,a.record.id);assert.equal(retry.created,false);
    assert.equal((await mcp('update_'+tool,{id:crypto.randomUUID(),expectedUpdatedAt:a.record.updatedAt,[field]:data})).data.result.isError,true);
  }
  assert.equal((await mcp('create_body_metric',{requestId:crypto.randomUUID(),metric:{...metric,profileId:crypto.randomUUID()}})).data.result.isError,true);
  const movedProfile=await createProfile(),requestId=crypto.randomUUID(),original={...metric,profileId:movedProfile};
  const moved=result(await mcp('create_body_metric',{requestId,metric:original})).record;saved.push({kind:'metric',id:moved.id});
  assert.ok(!((await mcp('update_body_metric',{id:moved.id,expectedUpdatedAt:moved.updatedAt,metric:{...metric,profileId:'self'}})).data.result.isError));
  assert.equal((await call('/api/data',{method:'DELETE',body:{kind:'profile',id:movedProfile}})).status,200);
  saved.splice(saved.findIndex(x=>x.id===movedProfile),1);
  const replay=result(await mcp('create_body_metric',{requestId,metric:original}));assert.equal(replay.record.id,moved.id);assert.equal(replay.record.profileId,'self');
  const imported=await call('/api/import-plan',{method:'POST',body:{text:'杠铃卧推 4组×8次 60kg'}});assert.equal(imported.status,200);assert.equal(imported.data.sets.length,4);
  assert.equal((await call('/api/import-plan',{method:'POST',body:{text:'卧推 3组×8次'},extraHeaders:{Origin:'https://external.invalid'}})).status,403);
  console.log('PASS: owner-only access; v4 CRUD; validation; MCP protocol + 12 tools; concurrent idempotency; stale updates; deleted-profile retries; import.');
}finally{
  for(const record of saved.reverse()){const r=await call('/api/data',{method:'DELETE',body:record});assert.equal(r.status,200,JSON.stringify(r.data));}
  console.log('Local API fixtures removed.');
}
