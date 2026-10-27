import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { dateSchema, profileIdSchema, schemas } from './model.ts';
import type { Kind } from './model.ts';
import { summarize, metricDefinitions } from './analytics.ts';
import { permits } from './oauth-contract.ts';

const empty = z.object({}).strict();
const range = z.object({profileId:profileIdSchema.optional(),from:dateSchema.optional(),to:dateSchema.optional()}).strict()
  .refine(v=>!v.from||!v.to||v.from<=v.to,'开始日期不能晚于结束日期');
const profile = z.object({profileId:profileIdSchema.optional()}).strict();
const uuid = z.string().uuid();
const updatedAt = z.string().datetime();
const writeArgs = (kind:Kind, update:boolean) => update
  ? z.object({id:uuid,expectedUpdatedAt:updatedAt,[kind === 'plan' ? 'plan' : kind]:schemas[kind]}).strict()
  : z.object({requestId:uuid,[kind === 'plan' ? 'plan' : kind]:schemas[kind]}).strict();

const definitions = [
  ['get_all_fitness_data','读取当前账号全部资料、训练、计划和身体指标，记录包含 profileId。',empty,false],
  ['list_profiles','读取当前账号可选的用户资料及基本健康信息。',empty,false],
  ['list_workouts','按资料和日期读取训练原始记录，包含每组次数、时间、重量、MCV 和 RPE。',range,false],
  ['list_training_plans','读取指定资料的训练计划及目标组记录。',profile,false],
  ['list_body_metrics','按资料和日期读取身体指标及来源。',range,false],
  ['get_training_summary','按资料和日期汇总训练频率、容量、工作组数和已知热量。',range,false],
  ['create_workout','创建完整训练记录。requestId 用于安全重试。',writeArgs('workout',false),true],
  ['update_workout','按版本更新完整训练记录。',writeArgs('workout',true),true],
  ['create_training_plan','创建完整训练计划。requestId 用于安全重试。',writeArgs('plan',false),true],
  ['update_training_plan','按版本更新完整训练计划。',writeArgs('plan',true),true],
  ['create_body_metric','创建身体指标。requestId 用于安全重试。',writeArgs('metric',false),true],
  ['update_body_metric','按版本更新身体指标。',writeArgs('metric',true),true],
] as const;

export const mcpTools = definitions.map(([name,description,schema,write])=>({
  name,description,inputSchema:zodToJsonSchema(schema,{target:'jsonSchema7', $refStrategy:'none'}),
  annotations:{readOnlyHint:!write,destructiveHint:write && name.startsWith('update_'),idempotentHint:write && name.startsWith('create_'),openWorldHint:false},
}));
export type McpIdentity = {userId:string;displayName?:string|null;scope:string};
export function toolScope(name:string) { const found=definitions.find(item=>item[0]===name); return found ? (found[3] ? 'repnote:write' : 'repnote:read') : null; }
export function listedTools(scope:string) { return mcpTools.filter(tool=>permits(scope,toolScope(tool.name)==='repnote:write')); }
export class McpToolError extends Error { code:string; constructor(code:string, message:string) {super(message);this.code=code;} }
const toolText = (data:unknown) => ({content:[{type:'text',text:JSON.stringify(data)}]});

export async function callMcpTool(name:string,args:unknown,identity:McpIdentity) {
  const definition=definitions.find(item=>item[0]===name);
  if(!definition)throw new McpToolError('UNKNOWN_TOOL','未知工具');
  const parsed=definition[2].safeParse(args);
  if(!parsed.success)throw new McpToolError('INVALID_ARGUMENTS','参数无效');
  const input=parsed.data as Record<string,unknown>;
  if(definition[3]) {
    const kind:Kind=name.includes('workout')?'workout':name.includes('training_plan')?'plan':'metric';
    const {createRecordForUser,updateRecordForUser}=await import('./data-service');
    try {
      const result=name.startsWith('create_')
        ? await createRecordForUser(identity.userId,kind,input[kind],input.requestId as string,'mcp')
        : await updateRecordForUser(identity.userId,kind,input.id as string,input[kind],input.expectedUpdatedAt as string,'mcp');
      return toolText({data:{...result,generatedAt:new Date().toISOString()}});
    } catch(error) {
      const code=error instanceof Error ? error.message : '';
      if(['PROFILE_NOT_FOUND','NOT_FOUND','VERSION_CONFLICT','IDEMPOTENCY_CONFLICT'].includes(code))
        throw new McpToolError(code,code);
      if(error instanceof z.ZodError)throw new McpToolError('INVALID_ARGUMENTS','参数无效');
      throw new McpToolError('WRITE_FAILED','无法保存记录');
    }
  }
  const {snapshot}=await import('./repository');
  const data=await snapshot(identity.userId,identity.displayName??undefined);
  const selectedId=(input.profileId as string|undefined)??'self';
  if(!data.profiles.some(p=>p.id===selectedId))throw new McpToolError('PROFILE_NOT_FOUND','资料不存在或无权访问');
  const from=input.from as string|undefined,to=input.to as string|undefined;
  const inRange=(v:{date:string})=>(!from||v.date>=from)&&(!to||v.date<=to);
  const owned=(v:{profileId?:string})=>(v.profileId??'self')===selectedId;
  const units={weight:'kg',volume:'kg',calories:'kcal',duration:'minutes',durationSeconds:'seconds',restSeconds:'seconds',bodyFat:'%',restingHeartRate:'bpm',rpe:'0–10, step 0.5'};
  const result=name==='get_all_fitness_data'?data:name==='list_profiles'?{profiles:data.profiles}:name==='list_workouts'?{profileId:selectedId,workouts:data.workouts.filter(owned).filter(inRange)}:name==='list_training_plans'?{profileId:selectedId,plans:data.plans.filter(owned)}:name==='list_body_metrics'?{profileId:selectedId,metrics:data.metrics.filter(owned).filter(inRange)}:{profileId:selectedId,...summarize(data.workouts.filter(owned),from,to)};
  return toolText({data:result,units,definitions:metricDefinitions,timezone:'Asia/Shanghai',generatedAt:data.exportedAt});
}
