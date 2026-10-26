import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptySet } from '../lib/model.ts';
import { exerciseGroups, addSetToExercise } from '../lib/exercise-groups.ts';
import { parsePlanText, toTrainingSets } from '../lib/import-plan.ts';

test('每个动作有独立组，新增组插入所属动作，重复名称也不合并',()=>{
  const first={...emptySet(),exercise:'卧推',weight:60};
  const second={...emptySet(),exercise:'划船',weight:40};
  const third={...emptySet(),exercise:'卧推',weight:30};
  const sets=[first,second,third];
  const added=addSetToExercise(sets,[0]);
  assert.deepEqual(exerciseGroups(added),[[0,1],[2],[3]]);
  assert.equal(added[1].exercise,'卧推');
  assert.equal(added[1].weight,60);
  assert.equal(added[1].groupId,first.groupId);
  assert.notEqual(added[1].id,first.id);
});

test('旧记录没有动作 ID 时仍按相邻动作分组',()=>{
  const a={...emptySet(),exercise:'卧推',groupId:undefined};
  const b={...emptySet(),exercise:'卧推',groupId:undefined};
  const c={...emptySet(),exercise:'划船',groupId:undefined};
  assert.deepEqual(exerciseGroups([a,b,c]),[[0,1],[2]]);
  assert.deepEqual(exerciseGroups(addSetToExercise([a,b,c],[0,1])),[[0,1,2],[3]]);
});

test('常见长计划文本转成多个动作和逐组草稿，缺失重量不猜测',()=>{
  const parsed=parsePlanText('杠铃卧推 4组×8次 60kg RPE8\n引体向上 3组×6次');
  const result=toTrainingSets(parsed);
  assert.equal(parsed.exercises.length,2);
  assert.equal(result.sets.length,7);
  assert.deepEqual(exerciseGroups(result.sets).map(group=>group.length),[4,3]);
  assert.equal(result.sets[0].weight,60);
  assert.equal(result.sets[4].weight,0);
  assert.equal(result.sets.every(set=>!set.completed),true);
  assert.ok(result.warnings.some(warning=>warning.includes('引体向上')));
});

test('无可辨认组数的文本拒绝导入',()=>{
  assert.throws(()=>parsePlanText('今天做了卧推，状态不错'));
});

test('截图式计划保留计时范围、组合动作、休息范围和相对负荷说明',()=>{
  const parsed=parsePlanText(`基线对照测试日（可延后至明天完成）
热身
3-5 min 有氧激活
2组 徒手深蹲 + 半蹲跳
深蹲10次 + 半蹲跳8次，组间休息45s
测试说明
负重杠铃CMJ
测试负荷：30% 体重
3组3次，取最快一组平均
组间休息：90-120 秒`);
  const {sets}=toTrainingSets(parsed);
  assert.equal(parsed.title,'基线对照测试日（可延后至明天完成）');
  assert.equal(sets.length,6);
  assert.equal(sets[0].reps,null);assert.equal(sets[0].durationSeconds,180);assert.equal(sets[0].durationMaxSeconds,300);
  assert.equal(sets[1].components?.[0].exercise,'深蹲');assert.equal(sets[1].components?.[0].reps,10);
  assert.equal(sets[1].components?.[1].exercise,'半蹲跳');assert.equal(sets[1].components?.[1].reps,8);
  assert.equal(sets[1].restSeconds,45);assert.equal(sets[1].completed,false);
  assert.equal(sets[3].warmup,false);assert.equal(sets[3].restSeconds,90);assert.equal(sets[3].restMaxSeconds,120);
  assert.match(sets[3].notes??'',/30% 体重/);assert.equal(sets[3].weight,0);
});

test('按组导入 MCV 数值，速度范围无法对应到具体组时不猜测',()=>{
  const parsed=parsePlanText('负重杠铃CMJ 3组3次\n记录：MCV 0.51 m/s，0.63 m/s，0.72 m/s');
  const {sets}=toTrainingSets(parsed);
  assert.deepEqual(sets.map(set=>set.mcv),[0.51,0.63,0.72]);
});
