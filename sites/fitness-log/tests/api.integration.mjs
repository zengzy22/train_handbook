import assert from 'node:assert/strict';
const origin=process.env.REPNOTE_TEST_ORIGIN??'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Integration fixtures are local-only');
const runId=crypto.randomUUID();const owners=['qa-'+runId,'qa-other-'+runId];const saved=[];
async function call(path,{owner=owners[0],method='GET',body,extraHeaders={}}={}){
 const r=await fetch(origin+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'qa@sites.test'}:{}),...(body?{'Content-Type':'application/json'}:{}),...extraHeaders},body:body?JSON.stringify(body):undefined});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data};
}
const set={id:crypto.randomUUID(),exercise:'QA Bench',muscle:'胸部',weight:60,reps:8,rpe:8,mcv:0.76,completed:true,warmup:false};
const workout={name:'QA API workout',date:'2026-10-21',durationMinutes:45,calories:null,calorieSource:null,feeling:4,status:'completed',notes:'local disposable fixture',sets:[set]};
const mcp=(name,args={},owner=owners[0])=>call('/mcp',{owner,method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});
try{
 assert.equal((await call('/api/data',{owner:null})).status,401);
 assert.equal((await call('/api/import-plan',{owner:null})).status,401);
 assert.equal((await call('/mcp',{owner:null,method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/list'}})).status,401);
 const importStatus=await call('/api/import-plan');assert.equal(importStatus.status,200);
 let imported=await call('/api/import-plan',{method:'POST',body:{text:'杠铃卧推 4组×8次 60kg\n引体向上 3组×6次'}});
 assert.equal(imported.status,200);assert.equal(imported.data.sets.length,7);assert.equal(imported.data.sets[0].completed,false);
 imported=await call('/api/import-plan',{method:'POST',body:{text:'热身\n3-5 min 有氧激活\n2组 徒手深蹲 + 半蹲跳\n深蹲10次 + 半蹲跳8次，组间休息45s'}});
 assert.equal(imported.status,200);assert.equal(imported.data.sets.length,3);
 assert.equal(imported.data.sets[0].durationSeconds,180);assert.equal(imported.data.sets[0].durationMaxSeconds,300);
 assert.equal(imported.data.sets[1].components[1].reps,8);assert.equal(imported.data.sets[1].restSeconds,45);
 assert.equal((await call('/api/import-plan',{method:'POST',body:{text:'卧推 3组×8次'},extraHeaders:{Origin:'https://external.invalid'}})).status,403);
 if(!importStatus.data.imageRecognitionAvailable)assert.equal((await call('/api/import-plan',{method:'POST',body:{imageDataUrl:'data:image/png;base64,AAAA'}})).status,503);
 let r=await call('/api/data');assert.equal(r.status,200);assert.equal(r.data.workouts.length,0);
 const timedSet={...set,id:crypto.randomUUID(),exercise:'QA timed',weight:0,reps:null,durationSeconds:120,durationMaxSeconds:180,completed:false};
const comboSet={...set,id:crypto.randomUUID(),exercise:'QA squat + jump',weight:0,reps:null,components:[{exercise:'QA squat',weight:40,reps:10,durationSeconds:null,mcv:0.81},{exercise:'QA jump',weight:null,reps:8,durationSeconds:null,mcv:1.24}],restSeconds:45,completed:false};
 for(const [kind,data,key] of [['workout',workout,'workouts'],['plan',{name:'QA Plan',description:'target',sets:[{...set,completed:false},timedSet,comboSet]},'plans'],['metric',{date:'2026-10-21',weight:70,bodyFat:18,restingHeartRate:60,source:'manual',notes:'fixture'},'metrics']]){
  r=await call('/api/data',{method:'PUT',body:{kind,data}});assert.equal(r.status,200);const record=r.data[key][0];assert.ok(record.id);saved.push({kind,id:record.id});
 }
 const original=await call('/api/data');assert.equal(original.data.schemaVersion,3);assert.equal(original.data.workouts.length,1);assert.equal(original.data.plans.length,1);assert.equal(original.data.metrics.length,1);
 assert.equal(original.data.workouts[0].sets[0].mcv,0.76);assert.equal(original.data.plans[0].sets[1].durationSeconds,120);assert.equal(original.data.plans[0].sets[2].components[1].reps,8);assert.equal(original.data.plans[0].sets[2].components[1].mcv,1.24);
 r=await call('/api/data',{owner:owners[1]});assert.equal(r.data.workouts.length,0);assert.equal(r.data.plans.length,0);assert.equal(r.data.metrics.length,0);
 assert.equal((await call('/api/data',{method:'PUT',owner:owners[1],body:{kind:'workout',id:saved[0].id,data:workout}})).status,404);
 assert.equal((await call('/api/data',{method:'DELETE',owner:owners[1],body:saved[0]})).status,404);
 r=await mcp('get_all_fitness_data');assert.equal(r.status,200);const snap=JSON.parse(r.data.result.content[0].text);assert.deepEqual(snap.data.workouts,original.data.workouts);assert.equal(snap.data.workouts[0].sets[0].mcv,0.76);assert.equal(snap.units.weight,'kg');
 r=await mcp('get_all_fitness_data',{},owners[1]);assert.equal(JSON.parse(r.data.result.content[0].text).data.workouts.length,0);
 r=await mcp('get_training_summary',{from:'2026-10-21',to:'2026-10-21'});assert.equal(JSON.parse(r.data.result.content[0].text).data.volumeKg,480);
 r=await mcp('list_workouts',{from:'2026-10-22'});assert.equal(JSON.parse(r.data.result.content[0].text).data.workouts.length,0);
 r=await mcp('list_workouts',{from:'2026-11-01',to:'2026-10-01'});assert.equal(r.data.result.isError,true);
 r=await call('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/list'}});assert.equal(r.data.result.tools.length,6);assert.ok(r.data.result.tools.every(t=>t.annotations.readOnlyHint));
 r=await call('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'server/discover'}});assert.ok(r.data.result.supportedVersions.includes('2026-07-28'));
 assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',data:{...workout,date:'2026-02-30'}}})).status,400);
 assert.equal((await call('/api/data',{method:'PUT',body:{kind:'workout',data:workout},extraHeaders:{Origin:'https://external.invalid'}})).status,403);
 r=await call('/api/data',{method:'PUT',body:{kind:'workout',id:saved[0].id,data:{...workout,name:'QA edited'}}});assert.equal(r.data.workouts[0].name,'QA edited');
 assert.equal((await call('/api/data')).data.workouts[0].name,'QA edited');
 assert.equal((await call('/api/data')).data.workouts[0].profileId,'self');
 const profileData={name:'QA second profile',birthDate:'1995-05-05',sex:'female',heightCm:170,notes:'local fixture'};
 r=await call('/api/data',{method:'PUT',body:{kind:'profile',data:profileData}});assert.equal(r.status,200);
 const profile=r.data.profiles.find(p=>p.name===profileData.name);assert.ok(profile?.id);saved.push({kind:'profile',id:profile.id});
 assert.equal((await call('/api/data',{method:'PUT',owner:owners[1],body:{kind:'metric',data:{date:'2026-10-21',weight:65,bodyFat:null,restingHeartRate:null,source:'manual',notes:'',profileId:profile.id}}})).status,404);
 assert.equal((await call('/api/data',{method:'DELETE',body:{kind:'profile',id:profile.id}})).status,200);
 r=await call('/api/data',{method:'PUT',body:{kind:'profile',data:profileData}});const second=r.data.profiles.find(p=>p.name===profileData.name);saved[saved.length-1]={kind:'profile',id:second.id};
 r=await call('/api/data',{method:'PUT',body:{kind:'workout',data:{...workout,name:'Second profile session',profileId:second.id}}});assert.equal(r.status,200);
 const secondWorkout=r.data.workouts.find(w=>w.profileId===second.id);saved.push({kind:'workout',id:secondWorkout.id});
 assert.equal((await call('/api/data',{method:'DELETE',body:{kind:'profile',id:second.id}})).status,409);
 r=await mcp('list_profiles');assert.equal(JSON.parse(r.data.result.content[0].text).data.profiles.length,2);
 r=await mcp('list_workouts');assert.equal(JSON.parse(r.data.result.content[0].text).data.workouts.length,1);
 r=await mcp('list_workouts',{profileId:second.id});assert.equal(JSON.parse(r.data.result.content[0].text).data.workouts[0].name,'Second profile session');
 r=await mcp('get_training_summary',{profileId:second.id});assert.equal(JSON.parse(r.data.result.content[0].text).data.volumeKg,480);
 r=await mcp('get_training_summary');assert.equal(JSON.parse(r.data.result.content[0].text).data.volumeKg,480);
 r=await mcp('list_training_plans',{profileId:second.id});assert.equal(JSON.parse(r.data.result.content[0].text).data.plans.length,0);
 r=await mcp('list_workouts',{profileId:crypto.randomUUID()});assert.equal(r.data.result.isError,true);
 r=await call('/api/data',{method:'PUT',body:{kind:'profile',id:second.id,data:{...profileData,name:'QA renamed'}}});assert.equal(r.data.profiles.find(p=>p.id===second.id).name,'QA renamed');
 console.log('PASS: anonymous rejection; import; CRUD; profile switching and isolation; cross-account denial; 6 read-only MCP tools; summaries; validation; CSRF.');
}finally{
 for(const record of saved.reverse()){const r=await call('/api/data',{method:'DELETE',body:record});assert.equal(r.status,200);}
 console.log('Local API fixtures removed.');
}
