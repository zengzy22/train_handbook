import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptySet,setSchema,workoutSchema,planSchema,emptyWorkout} from '../lib/model.ts';
import {setExerciseMode} from '../lib/exercise-groups.ts';
import {parsedPlanSchema} from '../lib/import-plan.ts';

test('RPE accepts null and only half steps from zero through ten',()=>{
  for(const rpe of [null,...Array.from({length:21},(_,i)=>i/2)])assert.equal(setSchema.safeParse({...emptySet(),exercise:'深蹲',rpe}).success,true);
  for(const rpe of [-.5,.1,1.2,7.25,10.5,NaN,Infinity]){
    const set={...emptySet(),exercise:'深蹲',rpe};
    assert.equal(workoutSchema.safeParse({...emptyWorkout(),sets:[set]}).success,false);
    assert.equal(planSchema.safeParse({name:'计划',description:'',sets:[set]}).success,false);
  }
  const imported=(rpe:number)=>({exercises:[{name:'深蹲',muscle:'腿部',sets:[{reps:8,rpe}]}]});
  assert.equal(parsedPlanSchema.safeParse(imported(0)).success,true);
  assert.equal(parsedPlanSchema.safeParse(imported(8.5)).success,true);
  assert.equal(parsedPlanSchema.safeParse(imported(8.2)).success,false);
});

test('switching a group to combo and back preserves first component and unrelated sets',()=>{
  const first={...emptySet(),exercise:'深蹲',weight:60,reps:8,mcv:.6,rpe:0,warmup:true,restSeconds:60};
  const second={...first,id:crypto.randomUUID(),weight:65};
  const other={...emptySet(),exercise:'卧推'};
  const combo=setExerciseMode([first,second,other],[0,1],true);
  assert.equal(combo[0].components?.length,2);
  assert.equal(combo[0].components?.[0].mcv,.6);
  assert.equal(combo[0].reps,null);
  assert.equal(combo[0].groupId,combo[1].groupId);
  combo[0].components![1]={exercise:'波比',weight:0,reps:5,durationSeconds:null};
  const single=setExerciseMode(combo,[0,1],false);
  assert.equal(single[0].exercise,'深蹲');assert.equal(single[0].weight,60);assert.equal(single[1].weight,65);
  assert.equal(single[0].components,undefined);assert.equal(single[0].mcv,.6);
  assert.equal(single[0].warmup,true);assert.equal(single[0].rpe,0);assert.equal(single[0].restSeconds,60);
  assert.equal(single[2],other);
  assert.equal(setSchema.safeParse(single[0]).success,true);
});

test('combo to single retains the first timed component and discards subsequent components',()=>{
  const set={...emptySet(),exercise:'组合',reps:null,components:[{exercise:'单车',weight:0,reps:null,durationSeconds:60,durationMaxSeconds:90,mcv:null},{exercise:'划船',weight:0,reps:12,durationSeconds:null}]};
  const [single]=setExerciseMode([set],[0],false);
  assert.equal(single.exercise,'单车');assert.equal(single.durationSeconds,60);assert.equal(single.durationMaxSeconds,90);
  assert.equal(single.reps,null);assert.equal(single.components,undefined);assert.equal(setSchema.safeParse(single).success,true);
});
