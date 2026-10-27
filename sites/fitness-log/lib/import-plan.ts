import { z } from 'zod';
import { setSchema, rpeSchema, type TrainingSet } from './model.ts';

const muscleSchema = z.enum(['胸部','背部','腿部','肩部','手臂','核心','全身','有氧']);
const count = z.number().int().min(1).max(1000).nullable().default(null);
const seconds = z.number().int().min(1).max(86_400).nullable().default(null);
const weight = z.number().finite().min(0).max(1500).nullable().default(null);
const velocity = z.number().finite().min(0).max(20).nullable().default(null);
const componentSchema = z.object({
  exercise:z.string().trim().min(1).max(100),weight,reps:count,durationSeconds:seconds,
  durationMaxSeconds:seconds.optional(),mcv:velocity,
});
const importedSetSchema = z.object({
  weight,reps:count,durationSeconds:seconds,durationMaxSeconds:seconds.optional(),
  restSeconds:seconds,restMaxSeconds:seconds.optional(),
  mcv:velocity,
  components:z.array(componentSchema).min(2).max(10).optional(),
  rpe:rpeSchema.default(null),
  warmup:z.boolean().default(false),notes:z.string().max(500).default(''),
});
export const parsedPlanSchema = z.object({
  title:z.string().trim().max(100).optional(), warnings:z.array(z.string().max(200)).max(30).optional(),
  exercises:z.array(z.object({
    name:z.string().trim().min(1).max(100),muscle:muscleSchema,
    sets:z.array(importedSetSchema).min(1).max(100),
  })).min(1).max(100),
});
export type ParsedPlan = z.infer<typeof parsedPlanSchema>;
type LocalSet = z.input<typeof importedSetSchema>;
type LocalExercise = {name:string;muscle:z.infer<typeof muscleSchema>;sets:LocalSet[];pendingCount:number;warmup:boolean;notes:string[]};

const validImportedCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000;
const validImportedSeconds = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 86_400;

// Model output is untrusted. Preserve explicit usable data, but never clamp or invent
// an implausible repetition count: it may be a date, duration, percentage, or OCR noise.
export function repairRecognizedPlan(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const source=value as Record<string,unknown>;
  if (!Array.isArray(source.exercises)) return value;
  const warnings=Array.isArray(source.warnings)?source.warnings.filter((item):item is string=>typeof item==='string'):[];
  const addWarning=(message:string)=>{if(warnings.length<30)warnings.push(message.slice(0,200));};
  const exercises=source.exercises.flatMap((entry,exerciseIndex)=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))return [entry];
    const exercise={...(entry as Record<string,unknown>)};
    if(!Array.isArray(exercise.sets))return [exercise];
    const name=typeof exercise.name==='string'&&exercise.name.trim()?exercise.name.trim():`第 ${exerciseIndex+1} 个动作`;
    const sets=exercise.sets.flatMap((entrySet,setIndex)=>{
      if(!entrySet||typeof entrySet!=='object'||Array.isArray(entrySet))return [entrySet];
      const set={...(entrySet as Record<string,unknown>)};
      if(set.reps!==null && set.reps!==undefined && !validImportedCount(set.reps)){
        addWarning(`${name}第 ${setIndex+1} 组：识别到异常次数“${String(set.reps)}”，已忽略`);
        set.reps=null;
      }
      if(Array.isArray(set.components)){
        set.components=set.components.flatMap((part,partIndex)=>{
          if(!part||typeof part!=='object'||Array.isArray(part))return [part];
          const component={...(part as Record<string,unknown>)};
          if(component.reps!==null && component.reps!==undefined && !validImportedCount(component.reps)){
            addWarning(`${name}第 ${setIndex+1} 组子动作 ${partIndex+1}：识别到异常次数“${String(component.reps)}”，已忽略`);
            component.reps=null;
          }
          return [component];
        });
      }
      const hasComponents=Array.isArray(set.components)&&set.components.length>=2;
      const hasReps=validImportedCount(set.reps);
      const hasDuration=validImportedSeconds(set.durationSeconds);
      if(!hasComponents&&!hasReps&&!hasDuration){
        addWarning(`${name}第 ${setIndex+1} 组：没有可确认的次数或时间，未导入`);
        return [];
      }
      return [set];
    });
    return sets.length?[{...exercise,sets}]:[];
  });
  return {...source,warnings:[...new Set(warnings)].slice(0,30),exercises};
}

export function toTrainingSets(plan: ParsedPlan): {sets: TrainingSet[]; warnings: string[]} {
  const parsed = parsedPlanSchema.parse(plan);
  const warnings = [...(parsed.warnings??[])];
  const sets = parsed.exercises.flatMap(exercise => {
    const groupId = crypto.randomUUID();
    return exercise.sets.map(set => {
      if (set.weight === null && set.reps !== null && !set.components?.length && exercise.muscle!=='有氧' && !/徒手|自重|空杆|跳|俯卧撑/.test(exercise.name)) warnings.push(`${exercise.name}：重量未给出，已暂记为 0 kg`);
      return setSchema.parse({
        id:crypto.randomUUID(),groupId,exercise:exercise.name,muscle:exercise.muscle,
        weight:set.weight??0,reps:set.components?.length?null:set.reps,
        durationSeconds:set.components?.length?null:set.durationSeconds,durationMaxSeconds:set.components?.length?null:set.durationMaxSeconds,
        restSeconds:set.restSeconds,restMaxSeconds:set.restMaxSeconds,
        mcv:set.mcv,
        components:set.components?.map(c=>({exercise:c.exercise,weight:c.weight,reps:c.reps,durationSeconds:c.durationSeconds,durationMaxSeconds:c.durationMaxSeconds,mcv:c.mcv})),
        rpe:set.rpe,warmup:set.warmup,completed:false,notes:set.notes,
      });
    });
  });
  if (sets.length > 300) throw new Error('最多导入 300 组，请拆分训练');
  return {sets,warnings:[...new Set(warnings)]};
}

function inferMuscle(name: string): z.infer<typeof muscleSchema> {
  if (/深蹲|硬拉|腿|臀|弓步|提踵|半蹲|跳跃|CMJ|Drop Jump/i.test(name)) return '腿部';
  if (/引体|划船|下拉|背/.test(name)) return '背部';
  if (/肩|侧平举|推举|借力推/.test(name)) return '肩部';
  if (/弯举|三头|二头|下压|臂/.test(name)) return '手臂';
  if (/卷腹|平板|核心/.test(name)) return '核心';
  if (/跑|骑|游泳|有氧|跳绳|拉伸|激活/.test(name)) return '有氧';
  if (/卧推|飞鸟|夹胸|俯卧撑|胸/.test(name)) return '胸部';
  return '全身';
}
function timeRange(value:string,unit:string):number {return Math.round(Number(value)*(unit==='min'||unit==='分钟'?60:1));}
function restTarget(line:string){
  const match=line.match(/(?:组间)?休息[：:\s]*(\d+(?:\.\d+)?)\s*(?:[-–—~～]\s*(\d+(?:\.\d+)?))?\s*(秒|s|min|分钟)/i);
  return match?{restSeconds:timeRange(match[1],match[3]),restMaxSeconds:match[2]?timeRange(match[2],match[3]):null}:null;
}
function mcvValues(line:string):number[]{
  if(!/(?:MCV|平均向心速度)/i.test(line))return [];
  return [...line.matchAll(/(\d+(?:\.\d+)?)\s*(?:m\/s|米\/秒)/gi)].map(match=>Number(match[1]));
}
function comboParts(line:string){
  const match=line.match(/(?:次数[：:]\s*)?([^+＋，,;；]+?)\s*(\d+)\s*次\s*[+＋]\s*([^+＋，,;；]+?)\s*(\d+)\s*次/);
  if(!match)return null;
  const first=match[1].trim().replace(/^.*?[：:]\s*/,'').trim(),second=match[3].trim();
  if(!first||!second)return null;
  return [{exercise:first,weight:null,reps:Number(match[2]),durationSeconds:null},{exercise:second,weight:null,reps:Number(match[4]),durationSeconds:null}];
}

// Conservative text fallback: preserves ranges and paired movements; ambiguous notes remain notes.
export function parsePlanText(text: string): ParsedPlan {
  const lines=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  const exercises:LocalExercise[]=[];
  const warnings:string[]=[];
  let current:LocalExercise|undefined, warmup=false, title='';
  const start=(name:string,pendingCount=0)=>{
    current={name:name.slice(0,100),muscle:inferMuscle(name),sets:[],pendingCount,warmup,notes:[]};
    exercises.push(current);return current;
  };
  const append=(target:LocalExercise,sets:LocalSet[])=>{target.sets.push(...sets);target.pendingCount=0;};
  for(const [index,raw] of lines.entries()){
    const line=raw.replace(/^[一二三四五六七八九十\d]+[.、)）]\s*/,'').replace(/^动作[：:]\s*/,'').trim();
    if(index===0 && /(?:训练|测试|计划).*日/.test(line) && !/\d+\s*组/.test(line)){title=line.slice(0,100);continue;}
    if(/^热身[：:]?$/.test(line)){warmup=true;current=undefined;continue;}
    if(/^(?:测试说明|汇总|注意事项|备注)[：:]?$/.test(line)){current=undefined;warmup=false;continue;}
    const timed=line.match(/^(\d+(?:\.\d+)?)\s*(?:[-–—~～]\s*(\d+(?:\.\d+)?))?\s*(min|分钟|s|秒)\s+(.+)$/i);
    if(timed){
      const name=timed[4].replace(/[，,].*$/,'').trim();
      const target=start(name);
      append(target,[{weight:null,reps:null,durationSeconds:timeRange(timed[1],timed[3]),durationMaxSeconds:timed[2]?timeRange(timed[2],timed[3]):null,warmup}]);
      continue;
    }
    const prescribed=line.match(/(\d+)\s*组\s*(?:[×x*／/]\s*)?(\d+)\s*次/i);
    if(prescribed){
      const count=Number(prescribed[1]),reps=Number(prescribed[2]);
      const name=line.slice(0,prescribed.index).replace(/[：:\-—\s]+$/,'').trim();
      const target=name?start(name):current;
      if(target && count<=100 && reps<=1000){
        const kg=line.match(/(\d+(?:\.\d+)?)\s*kg/i);
        const rpe=line.match(/RPE\s*(\d+(?:\.\d+)?)/i);
        const rest=restTarget(line);
        append(target,Array.from({length:count},()=>({weight:kg?Number(kg[1]):null,reps,durationSeconds:null,restSeconds:rest?.restSeconds??null,restMaxSeconds:rest?.restMaxSeconds??null,rpe:rpe?Number(rpe[1]):null,warmup:target.warmup,notes:target.notes.join('；')})));
      }
      continue;
    }
    const pair=comboParts(line);
    if(pair){
      const target=current??start(pair.map(c=>c.exercise).join(' + '));
      const rest=restTarget(line),total=target.pendingCount||1;
      append(target,Array.from({length:total},()=>({weight:null,reps:null,durationSeconds:null,components:pair,restSeconds:rest?.restSeconds??null,restMaxSeconds:rest?.restMaxSeconds??null,warmup:target.warmup,notes:target.notes.join('；')})));
      continue;
    }
    const rest=restTarget(line);
    if(rest&&current){current.sets=current.sets.map(set=>({...set,...rest}));continue;}
    const velocities=mcvValues(line);
    if(velocities.length&&current&&velocities.every(value=>value<=20)&&(velocities.length===current.sets.length||velocities.length===1&&current.sets.length===1)){
      current.sets=current.sets.map((set,index)=>({...set,mcv:velocities[index]}));continue;
    }
    const heading=line.match(/^(\d+)\s*组\s+(.+)$/);
    if(heading && !/\d+\s*次/.test(heading[2])){start(heading[2],Number(heading[1]));continue;}
    const group=line.match(/^(?:第\s*\d+\s*组[：:]?\s*)?(\d+(?:\.\d+)?)\s*kg\s*[×x*]?\s*(\d+)\s*(?:次|reps?)?/i);
    if(group&&current){append(current,[{weight:Number(group[1]),reps:Number(group[2]),warmup:current.warmup,notes:current.notes.join('；')}]);continue;}
    if(current && /测试负荷|目标|取最快|MCV|记录[：:]|注意|动作质量/.test(line)){
      current.notes.push(line.slice(0,180));
      if(current.sets.length)current.sets=current.sets.map(set=>({...set,notes:[set.notes,line].filter(Boolean).join('；').slice(0,500)}));
      continue;
    }
    if(!/\d+\s*(?:kg|次|组|%|小时)/i.test(line) && line.length<=100 && !/^(?:每个动作|测试前|预计|下周|比基线|与基线|点击|计划说明)/.test(line)){
      start(line.replace(/[：:]$/,''));
    }else if(/\d+\s*组/.test(line) && !/组间/.test(line))warnings.push(`未能确定「${line.slice(0,45)}」的完整动作或次数，请手动检查`);
  }
  const valid=exercises.filter(exercise=>exercise.sets.length);
  if(!valid.length)throw new Error('未识别到动作和组数，请检查文本格式或启用 DeepSeek 识别');
  return parsedPlanSchema.parse({title,warnings,exercises:valid.map(({name,muscle,sets})=>({name,muscle,sets}))});
}
