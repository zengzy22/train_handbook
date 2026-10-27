import type { TrainingSet } from './model.ts';

export function exerciseGroups(sets: TrainingSet[]): number[][] {
  const groups: number[][] = [];
  sets.forEach((set,index) => {
    const last = groups.at(-1), first = last && sets[last[0]];
    const same = first && (first.groupId || set.groupId
      ? Boolean(first.groupId && first.groupId === set.groupId)
      : first.exercise === set.exercise && first.muscle === set.muscle);
    if (last && same) last.push(index);
    else groups.push([index]);
  });
  return groups;
}

export function addSetToExercise(sets: TrainingSet[], indices: number[]): TrainingSet[] {
  const groupId = sets[indices[0]].groupId ?? crypto.randomUUID();
  const after = indices.at(-1)!;
  const next = sets.map((set,index) => indices.includes(index) ? {...set,groupId} : set);
  next.splice(after + 1,0,{...next[after],id:crypto.randomUUID(),completed:false,warmup:false});
  return next;
}

export function setExerciseMode(sets:TrainingSet[],indices:number[],combo:boolean):TrainingSet[] {
  const selected=new Set(indices),groupId=sets[indices[0]].groupId??crypto.randomUUID();
  return sets.map((set,index)=>{
    if(!selected.has(index))return set;
    if(combo){
      if(set.components?.length)return {...set,groupId};
      return {...set,groupId,exercise:set.exercise?`${set.exercise} + 组合动作`:'组合动作',weight:0,reps:null,durationSeconds:null,durationMaxSeconds:null,mcv:null,
        components:[{exercise:set.exercise,weight:set.weight,reps:set.reps,durationSeconds:set.durationSeconds??null,durationMaxSeconds:set.durationMaxSeconds??null,mcv:set.mcv??null},{exercise:'',weight:null,reps:null,durationSeconds:null}]};
    }
    if(!set.components?.length)return {...set,groupId};
    const {components,...single}=set,first=components[0];
    return {...single,groupId,exercise:first.exercise,weight:first.weight??0,reps:first.reps,durationSeconds:first.durationSeconds,durationMaxSeconds:first.durationMaxSeconds??null,mcv:first.mcv??null};
  });
}
