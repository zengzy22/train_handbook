import { getChatGPTUser } from '../../chatgpt-auth';
import { snapshot, saveRecord, saveProfile, profileExists, deleteRecord, deleteProfile } from '../../../lib/repository';
import { mutationSchema, deleteSchema, schemas, profileSchema } from '../../../lib/model';
import { ZodError } from 'zod';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function run(request:Request,action:'read'|'save'|'delete'){
  const user=await getChatGPTUser(); if(!user)return json({error:'请先登录'},401);
  if(action!=='read'){
    const origin=request.headers.get('origin');
    if(origin && origin!==new URL(request.url).origin)return json({error:'不允许跨站写入'},403);
    if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'需要 JSON 请求'},415);
  }
  try{
    if(action==='read')return json(await snapshot(user.userId,user.fullName??user.displayName));
    const raw=await request.text(); if(raw.length>250000)return json({error:'记录过大'},413);
    const body=JSON.parse(raw);
    if(action==='save'){
      const mutation=mutationSchema.parse(body);
      if(mutation.kind==='profile')await saveProfile(user.userId,profileSchema.parse(mutation.data),mutation.id);
      else{
        const parsed=schemas[mutation.kind].parse(mutation.data);
        const profileId=parsed.profileId??'self';
        if(!await profileExists(user.userId,profileId))return json({error:'用户不存在或无权访问'},404);
        await saveRecord(user.userId,mutation.kind,{...parsed,profileId},mutation.id);
      }
    }
    else{const {kind,id}=deleteSchema.parse(body);if(kind==='profile')await deleteProfile(user.userId,id);else await deleteRecord(user.userId,kind,id);}
    return json(await snapshot(user.userId,user.fullName??user.displayName));
  }catch(e){
    if(e instanceof ZodError)return json({error:e.issues.map(i=>i.message).join('；')},400);
    if(e instanceof SyntaxError)return json({error:'JSON 格式错误'},400);
    if(e instanceof Error&&e.message==='NOT_FOUND')return json({error:'记录不存在或无权访问'},404);
    if(e instanceof Error&&e.message==='PROFILE_HAS_DATA')return json({error:'该用户仍有训练、计划或指标记录'},409);
    console.error('Data operation failed',e);return json({error:'保存或读取失败，请稍后重试'},500);
  }
}
export const GET=(r:Request)=>run(r,'read');
export const PUT=(r:Request)=>run(r,'save');
export const DELETE=(r:Request)=>run(r,'delete');
