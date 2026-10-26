import { getChatGPTUser } from '../chatgpt-auth';
import { snapshot } from '../../lib/repository';
import { dateSchema, profileIdSchema } from '../../lib/model';
import { summarize, metricDefinitions } from '../../lib/analytics';
import { z } from 'zod';
export const dynamic='force-dynamic';
const range={type:'object',properties:{profileId:{type:'string',description:'资料 ID，默认 self；可先调用 list_profiles'},from:{type:'string',description:'开始日期 YYYY-MM-DD（包含）'},to:{type:'string',description:'结束日期 YYYY-MM-DD（包含）'}},additionalProperties:false};
const profileArg={type:'object',properties:{profileId:{type:'string',description:'资料 ID，默认 self；可先调用 list_profiles'}},additionalProperties:false};
const empty={type:'object',properties:{},additionalProperties:false};
const tools=[
  {name:'get_all_fitness_data',description:'读取当前账号全部资料、训练、计划和身体指标，记录包含 profileId。',inputSchema:empty},
  {name:'list_profiles',description:'读取当前账号可选的用户资料及基本健康信息。',inputSchema:empty},
  {name:'list_workouts',description:'按资料和日期读取训练原始记录，包含单动作与组合动作、次数、计时秒、休息秒、重量 kg、MCV（平均向心速度 m/s）和 RPE。默认资料 self。',inputSchema:range},
  {name:'list_training_plans',description:'读取指定资料的训练计划及目标组记录。默认资料 self。',inputSchema:profileArg},
  {name:'list_body_metrics',description:'按资料和日期读取身体指标及来源。默认资料 self。',inputSchema:range},
  {name:'get_training_summary',description:'按资料和日期汇总训练频率、容量 kg、工作组数、已知热量 kcal。默认资料 self。',inputSchema:range},
].map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}));
const ranges=z.object({profileId:profileIdSchema.optional(),from:dateSchema.optional(),to:dateSchema.optional()}).strict().refine(v=>!v.from||!v.to||v.from<=v.to,'开始日期不能晚于结束日期');
const profileOnly=z.object({profileId:profileIdSchema.optional()}).strict();
export async function POST(request:Request){
  const user=await getChatGPTUser(); if(!user)return Response.json({error:'Authentication required'},{status:401});
  let rpc:any;
  const respond=(result:unknown)=>Response.json({jsonrpc:'2.0',id:rpc.id,result},{headers:{'Cache-Control':'no-store'}});
  try{
    const raw=await request.text();if(raw.length>10000)return new Response('Request too large',{status:413});
    rpc=JSON.parse(raw);
    if(rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return Response.json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32600,message:'Invalid Request'}});
    if(rpc.id===undefined)return new Response(null,{status:202});
    if(rpc.method==='server/discover')return respond({serverInfo:{name:'Repnote',version:'1.0.0'},supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
    if(rpc.method==='initialize')return respond({protocolVersion:'2025-11-25',serverInfo:{name:'Repnote',version:'1.0.0'},capabilities:{tools:{}}});
    if(rpc.method==='ping')return respond({});
    if(rpc.method==='tools/list')return respond({tools});
    if(rpc.method!=='tools/call')return Response.json({jsonrpc:'2.0',id:rpc.id,error:{code:-32601,message:'Method not found'}});
    const {name,arguments:args={}}=rpc.params??{};
    if(!tools.some(t=>t.name===name))throw new Error('未知工具');
    const {from,to,profileId}=name==='get_all_fitness_data'||name==='list_profiles'?(z.object({}).strict().parse(args),{from:undefined,to:undefined,profileId:undefined}):name==='list_training_plans'?{...profileOnly.parse(args),from:undefined,to:undefined}:ranges.parse(args);
    const data=await snapshot(user.userId,user.fullName??user.displayName);
    const selectedId=profileId??'self';
    if(!data.profiles.some(p=>p.id===selectedId))throw new Error('资料不存在或无权访问');
    const inRange=(v:{date:string})=>(!from||v.date>=from)&&(!to||v.date<=to);
    const owned=(v:{profileId?:string})=>(v.profileId??'self')===selectedId;
    const units={weight:'kg',volume:'kg',calories:'kcal',duration:'minutes',durationSeconds:'seconds',restSeconds:'seconds',bodyFat:'%',restingHeartRate:'bpm',rpe:'1–10'};
    const result=name==='get_all_fitness_data'?data:name==='list_profiles'?{profiles:data.profiles}:name==='list_workouts'?{profileId:selectedId,workouts:data.workouts.filter(owned).filter(inRange)}:name==='list_training_plans'?{profileId:selectedId,plans:data.plans.filter(owned)}:name==='list_body_metrics'?{profileId:selectedId,metrics:data.metrics.filter(owned).filter(inRange)}:{profileId:selectedId,...summarize(data.workouts.filter(owned),from,to)};
    return respond({content:[{type:'text',text:JSON.stringify({data:result,units,definitions:metricDefinitions,timezone:'Asia/Shanghai',generatedAt:data.exportedAt})}]});
  }catch(e){
    if(rpc?.method==='tools/call')return respond({isError:true,content:[{type:'text',text:e instanceof z.ZodError?'参数无效：请检查资料 ID 和日期范围':e instanceof Error&&['未知工具','资料不存在或无权访问'].includes(e.message)?e.message:'无法读取训练数据'}]});
    return Response.json({jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32700,message:'Invalid JSON-RPC request'}},{status:400});
  }
}
export async function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
