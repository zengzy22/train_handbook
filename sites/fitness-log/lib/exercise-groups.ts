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
