import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkout, emptySet, dateSchema, workoutSchema, planSchema, metricSchema, localDate } from '../lib/model.ts';
import type { Workout, Snapshot } from '../lib/model.ts';
import { volume, summarize, estimated1RM, toCSV, csvCell } from '../lib/analytics.ts';
const set=()=>({...emptySet(),exercise:'杠铃卧推',weight:60,reps:8,completed:true,rpe:8});
const workout=(patch:Partial<Workout>={}):Workout=>({...emptyWorkout('2026-10-21'),id:crypto.randomUUID(),createdVia:'web',updatedVia:'mcp',createdAt:'2026-10-21T01:00:00Z',updatedAt:'2026-10-21T01:00:00Z',status:'completed',sets:[set()],...patch});
test('容量只包括结束训练中完成的非热身组，自重不虚构额外重量',()=>{
 const w=workout({sets:[set(),{...set(),warmup:true},{...set(),completed:false},{...set(),weight:0}]});
 assert.equal(volume(w),480);assert.equal(volume({...w,status:'draft'}),0);
});
test('汇总日期边界包含端点，草稿和区间外训练不进入统计',()=>{
 const s=summarize([workout({date:'2026-10-01'}),workout(),workout({date:'2026-10-22'}),workout({status:'draft'})],'2026-10-01','2026-10-21');
 assert.equal(s.sessions,2);assert.equal(s.trainingDays,2);assert.equal(s.volumeKg,960);assert.equal(s.sets,2);assert.equal(s.averageRpe,8);
});
test('未知热量和时长保持 null，明确输入0热量仍为已知值',()=>{
 assert.equal(summarize([workout()]).calories,null);assert.equal(summarize([]).durationMinutes,null);
 const s=summarize([workout({calories:0,calorieSource:'device',durationMinutes:50}),workout({calories:320,calorieSource:'manual'}),workout()]);
 assert.equal(s.calories,320);assert.equal(s.calorieRecordedSessions,2);assert.equal(s.durationMinutes,50);
});
test('1RM只用于完成、非热身、负重且1–10次的组',()=>{
 assert.equal(estimated1RM({...set(),reps:1}),60);assert.equal(estimated1RM({...set(),reps:10}),80);
 for(const patch of [{warmup:true},{completed:false},{weight:0},{reps:11}])assert.equal(estimated1RM({...set(),...patch}),null);
});
test('计时组与组合动作保留各自指标，组合容量逐项计算但不估算1RM',()=>{
 const timed={...set(),reps:null,durationSeconds:180,durationMaxSeconds:300,weight:0};
 const combo={...set(),exercise:'深蹲 + 半蹲跳',reps:null,weight:0,components:[{exercise:'深蹲',weight:40,reps:10,durationSeconds:null,mcv:0.72},{exercise:'半蹲跳',weight:null,reps:8,durationSeconds:null,mcv:1.14}],restSeconds:45,mcv:0.72};
 assert.equal(workoutSchema.safeParse({...emptyWorkout(),status:'completed',sets:[timed,combo]}).success,true);
 assert.equal(volume(workout({sets:[timed,combo]})),400);
 assert.equal(estimated1RM(combo),null);
 assert.equal(workoutSchema.safeParse({...emptyWorkout(),sets:[{...set(),mcv:20.1}]}).success,false);
 assert.equal(workoutSchema.safeParse({...emptyWorkout(),sets:[{...timed,durationSeconds:null}]}).success,false);
 assert.equal(workoutSchema.safeParse({...emptyWorkout(),sets:[{...combo,components:[...combo.components,{exercise:'',weight:null,reps:null,durationSeconds:null}]}]}).success,false);
});
test('拒绝非法日期、非有限数值、未填动作、重复组和不一致热量来源',()=>{
 assert.equal(dateSchema.safeParse('2026-02-30').success,false);assert.equal(dateSchema.safeParse('2024-02-29').success,true);
 assert.equal(workoutSchema.safeParse(workout()).success,false); // metadata must not be accepted in mutation payload
 const w={...emptyWorkout(),sets:[set()],status:'completed' as const};assert.equal(workoutSchema.safeParse(w).success,true);
 assert.equal(workoutSchema.safeParse({...w,calories:5}).success,false);
 assert.equal(workoutSchema.safeParse({...w,sets:[{...set(),weight:Infinity}]}).success,false);
 assert.equal(workoutSchema.safeParse({...w,sets:[{...set(),exercise:' '}]}).success,false);
 assert.equal(workoutSchema.safeParse({...w,sets:[w.sets[0],w.sets[0]]}).success,false);
 assert.equal(workoutSchema.safeParse({...w,sets:[{...set(),completed:false}]}).success,false);
});
test('身体指标至少有一项；计划至少包含一个合法动作',()=>{
 const m={date:'2026-10-21',weight:null,bodyFat:null,restingHeartRate:null,source:'manual',notes:''};
 assert.equal(metricSchema.safeParse(m).success,false);assert.equal(metricSchema.safeParse({...m,weight:70}).success,true);
 assert.equal(metricSchema.safeParse({...m,bodyFat:90}).success,false);
 assert.equal(planSchema.safeParse({name:'推日',description:'',sets:[]}).success,false);
 assert.equal(planSchema.safeParse({name:'推日',description:'',sets:[set()]}).success,true);
});
test('导出保留原始组、关联ID和草稿状态，正确转义文本并防表格公式执行',()=>{
 assert.equal(csvCell('=HYPERLINK("evil")'),'"\'=HYPERLINK(""evil"")"');assert.equal(csvCell('line1\nline2'),'"line1\nline2"');assert.equal(csvCell(-5),'-5');
 const w=workout({name:'推日, 胸部',status:'draft'});const data:Snapshot={schemaVersion:4,exportedAt:'2026-10-21',timezone:'Asia/Shanghai',profiles:[{id:'self',name:'曾昭瑜',birthDate:null,sex:null,heightCm:null,notes:'',createdVia:'web',updatedVia:'web',createdAt:'2026-10-21',updatedAt:'2026-10-21'}],workouts:[w],plans:[],metrics:[]};
 for(const kind of ['profiles','workouts','sets','plans','metrics'] as const){assert.ok(toCSV(data,kind).includes('createdVia'));assert.ok(toCSV(data,kind).includes('updatedVia'));}
 assert.ok(toCSV(data,'workouts').includes('mcp'));assert.equal(JSON.parse(JSON.stringify(data)).workouts[0].updatedVia,'mcp');
 const csv=toCSV(data,'sets');assert.ok(csv.includes(w.id));assert.ok(csv.includes('draft'));assert.ok(csv.includes('杠铃卧推'));assert.ok(csv.includes('"推日, 胸部"'));
 assert.ok(toCSV({...data,workouts:[]},'workouts').includes('calorieSource'));
 assert.ok(toCSV(data,'profiles').includes('曾昭瑜'));assert.ok(toCSV(data,'workouts').includes('self'));
 const combo=workout({sets:[{...set(),exercise:'深蹲 + 半蹲跳',reps:null,weight:0,components:[{exercise:'深蹲',weight:40,reps:10,durationSeconds:null},{exercise:'半蹲跳',weight:null,reps:8,durationSeconds:null}],restSeconds:45}]});
 assert.ok(toCSV({...data,workouts:[combo]},'sets').includes('半蹲跳'));assert.ok(toCSV({...data,workouts:[combo]},'sets').includes('restSeconds'));assert.ok(toCSV({...data,workouts:[combo]},'sets').includes('mcv'));
});
test('日期以亚洲上海时区截断',()=>{assert.equal(localDate(new Date('2026-10-20T17:00:00Z')),'2026-10-21');});
