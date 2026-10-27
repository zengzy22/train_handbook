import type { Workout, TrainingSet, Snapshot } from './model.ts';
export const metricDefinitions = {
  volume: '已完成训练中，已完成且非热身组的重量 kg × 次数之和；组合动作逐项计算，不包含自重与计时项目。',
  estimated1RM: 'Epley：重量 × (1 + 次数 / 30)，1 次时取实际重量；仅计算单动作、1–10 次、重量大于 0 的完成工作组。组合动作不估算 1RM。',
  calories: '仅汇总已完成训练中用户手动填写或设备提供的热量；未记录时为 null，不估算。',
  timedSets: '组内时间和组间休息以秒记录，区间保留下限与上限；计划目标不自动计入实际训练时长。',
  velocity: 'MCV 为平均向心速度，单位 m/s；组数据原样保留，可按动作比较各组并识别最快记录。',
};
export function workingSets(w: Workout) { return w.status === 'completed' ? w.sets.filter(s=>s.completed && !s.warmup) : []; }
export function volume(w: Workout) { return workingSets(w).reduce((n,s)=>n+(s.components?.length?s.components.reduce((m,c)=>m+(c.weight??0)*(c.reps??0),0):s.weight*(s.reps??0)),0); }
export function estimated1RM(s: TrainingSet) { return !s.components?.length && s.completed && !s.warmup && s.weight>0 && s.reps!==null && s.reps<=10 ? (s.reps===1?s.weight:s.weight*(1+s.reps/30)):null; }
export function summarize(workouts: Workout[], from = '0000-01-01', to = '9999-12-31') {
  const completed = workouts.filter(w=>w.status==='completed' && w.date>=from && w.date<=to);
  const knownCalories = completed.filter(w=>w.calories!==null);
  return {from, to, sessions:completed.length, trainingDays:new Set(completed.map(w=>w.date)).size,
    volumeKg:completed.reduce((n,w)=>n+volume(w),0), sets:completed.reduce((n,w)=>n+workingSets(w).length,0),
    durationMinutes:completed.some(w=>w.durationMinutes!==null)?completed.reduce((n,w)=>n+(w.durationMinutes??0),0):null,
    calories:knownCalories.length?knownCalories.reduce((n,w)=>n+w.calories!,0):null,
    calorieRecordedSessions:knownCalories.length,
    averageRpe:(()=>{const a=completed.flatMap(workingSets).map(s=>s.rpe).filter((x):x is number=>x!==null); return a.length?a.reduce((n,x)=>n+x,0)/a.length:null;})()};
}
export function csvCell(value: unknown) {
  let s=value===null||value===undefined?'':String(value);
  if (typeof value==='string' && /^[\s]*[=+\-@\t\r]/.test(s)) s="'"+s;
  return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
export function toCSV(snapshot: Snapshot, kind: 'profiles'|'workouts'|'sets'|'plans'|'metrics') {
  let rows: Record<string,unknown>[];
  if(kind==='profiles') rows=snapshot.profiles;
  else if(kind==='sets') rows=snapshot.workouts.flatMap(w=>w.sets.map((s,i)=>({profileId:w.profileId??'self',workoutId:w.id,date:w.date,workoutName:w.name,workoutStatus:w.status,createdVia:w.createdVia,updatedVia:w.updatedVia,order:i+1,...s,components:s.components?JSON.stringify(s.components):''})));
  else if(kind==='workouts') rows=snapshot.workouts.map(({sets,...w})=>({...w,profileId:w.profileId??'self',setCount:sets.length}));
  else if(kind==='plans') rows=snapshot.plans.flatMap(p=>p.sets.map((s,i)=>({profileId:p.profileId??'self',planId:p.id,name:p.name,description:p.description,createdAt:p.createdAt,updatedAt:p.updatedAt,createdVia:p.createdVia,updatedVia:p.updatedVia,order:i+1,...s,components:s.components?JSON.stringify(s.components):''})));
  else rows=snapshot.metrics.map(m=>({...m,profileId:m.profileId??'self'}));
  const fallback={profiles:['id','name','birthDate','sex','heightCm','notes','createdAt','updatedAt'],workouts:['id','profileId','name','date','durationMinutes','calories','calorieSource','feeling','status','notes','createdAt','updatedAt','setCount'],sets:['profileId','workoutId','date','workoutName','workoutStatus','order','id','groupId','exercise','muscle','weight','reps','durationSeconds','durationMaxSeconds','restSeconds','restMaxSeconds','mcv','components','notes','rpe','completed','warmup'],plans:['profileId','planId','name','description','createdAt','updatedAt','order','id','groupId','exercise','muscle','weight','reps','durationSeconds','durationMaxSeconds','restSeconds','restMaxSeconds','mcv','components','notes','rpe','completed','warmup'],metrics:['id','profileId','date','weight','bodyFat','restingHeartRate','source','notes','createdAt','updatedAt']};
  const columns=[...fallback[kind],'createdVia','updatedVia'];
  return '\uFEFF'+[columns.map(csvCell).join(','),...rows.map(r=>columns.map(k=>csvCell(r[k])).join(','))].join('\r\n');
}
