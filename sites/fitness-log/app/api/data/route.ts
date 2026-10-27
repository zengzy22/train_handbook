import { getOwnerAccess } from '../../../lib/owner';
import { snapshot, saveProfile, deleteRecord, deleteProfile } from '../../../lib/repository';
import { createRecordForUser, updateRecordForUser } from '../../../lib/data-service';
import { mutationSchema, deleteSchema, profileSchema } from '../../../lib/model';
import { ZodError } from 'zod';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function run(request:Request,action:'read'|'save'|'delete'){
  const {user,response}=await getOwnerAccess(); if(!user)return response!;
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
        if(mutation.id)await updateRecordForUser(user.userId,mutation.kind,mutation.id,mutation.data,mutation.expectedUpdatedAt!,'web');
        else await createRecordForUser(user.userId,mutation.kind,mutation.data,undefined,'web');
      }
    }
    else{const {kind,id}=deleteSchema.parse(body);if(kind==='profile')await deleteProfile(user.userId,id);else await deleteRecord(user.userId,kind,id);}
    return json(await snapshot(user.userId,user.fullName??user.displayName));
  }catch(e){
    if(e instanceof ZodError)return json({error:e.issues.map(i=>i.message).join('；')},400);
    if(e instanceof SyntaxError)return json({error:'JSON 格式错误'},400);
    if(e instanceof Error&&e.message==='NOT_FOUND')return json({error:'记录不存在或无权访问'},404);
    if(e instanceof Error&&e.message==='PROFILE_NOT_FOUND')return json({error:'用户不存在或无权访问'},404);
    if(e instanceof Error&&e.message==='VERSION_CONFLICT')return json({error:'这条记录已在其他位置更新。你的编辑仍然保留，请重新打开最新记录后合并修改。',code:'VERSION_CONFLICT'},409);
    if(e instanceof Error&&e.message==='IDEMPOTENCY_CONFLICT')return json({error:'请求标识已被其他记录使用',code:'IDEMPOTENCY_CONFLICT'},409);
    if(e instanceof Error&&e.message==='PROFILE_HAS_DATA')return json({error:'该用户仍有训练、计划或指标记录'},409);
    console.error('Data operation failed',e);return json({error:'保存或读取失败，请稍后重试'},500);
  }
}
export const GET=(r:Request)=>run(r,'read');
export const PUT=(r:Request)=>run(r,'save');
export const DELETE=(r:Request)=>run(r,'delete');
