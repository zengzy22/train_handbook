import { getDb } from '../db';
import { records } from '../db/schema';
import { and, eq, desc } from 'drizzle-orm';
import type { Kind, Snapshot, Workout, Plan, Metric, Profile, ProfileInput, Via } from './model';
import { nextUpdatedAt, matchCreateRequest } from './write-rules';
export type RecordRow = typeof records.$inferSelect;
export function domainRecord(row:RecordRow):Workout|Plan|Metric {
  const payload=JSON.parse(row.payload);
  return {...payload,profileId:payload.profileId??'self',id:row.id,createdAt:row.createdAt,updatedAt:row.updatedAt,createdVia:row.createdVia,updatedVia:row.updatedVia};
}
export async function snapshot(userId: string, defaultName = '我的资料'): Promise<Snapshot> {
  const rows=await getDb().select().from(records).where(eq(records.userId,userId)).orderBy(desc(records.createdAt));
  const now=new Date().toISOString();
  const result:Snapshot={schemaVersion:4,exportedAt:now,timezone:'Asia/Shanghai',profiles:[],workouts:[],plans:[],metrics:[]};
  for(const row of rows){const item={...JSON.parse(row.payload),id:row.id,createdAt:row.createdAt,updatedAt:row.updatedAt,createdVia:row.createdVia,updatedVia:row.updatedVia};
    if(row.kind==='profile'){result.profiles.push(item as Profile);continue;}
    item.profileId??='self';
    if(row.kind==='workout')result.workouts.push(item as Workout);else if(row.kind==='plan')result.plans.push(item as Plan);else if(row.kind==='metric')result.metrics.push(item as Metric);
  }
  if(!result.profiles.some(p=>p.id==='self'))result.profiles.unshift({id:'self',name:defaultName,birthDate:null,sex:null,heightCm:null,notes:'',createdAt:now,updatedAt:now,createdVia:'web',updatedVia:'web'});
  result.profiles.sort((a,b)=>a.id==='self'?-1:b.id==='self'?1:a.createdAt.localeCompare(b.createdAt));
  return result;
}
export async function profileExists(userId:string,profileId:string){
  if(profileId==='self')return true;
  const found=await getDb().select({id:records.id}).from(records).where(and(eq(records.userId,userId),eq(records.id,profileId),eq(records.kind,'profile'))).limit(1);
  return found.length>0;
}
export async function saveProfile(userId:string,data:ProfileInput,id?:string){
  const db=getDb(),now=new Date().toISOString();
  if(id){
    const saved=await db.update(records).set({payload:JSON.stringify(data),updatedAt:now}).where(and(eq(records.userId,userId),eq(records.id,id),eq(records.kind,'profile'))).returning({id:records.id});
    if(saved.length)return id;
    if(id!=='self')throw new Error('NOT_FOUND');
  }
  const newId=id??crypto.randomUUID();
  await db.insert(records).values({userId,id:newId,kind:'profile',payload:JSON.stringify(data),createdAt:now,updatedAt:now});
  return newId;
}
export async function deleteProfile(userId:string,id:string){
  const data=await snapshot(userId);
  if([...data.workouts,...data.plans,...data.metrics].some(item=>item.profileId===id))throw new Error('PROFILE_HAS_DATA');
  const deleted=await getDb().delete(records).where(and(eq(records.userId,userId),eq(records.id,id),eq(records.kind,'profile'))).returning({id:records.id});
  if(!deleted.length)throw new Error('NOT_FOUND');
}
export async function findRecord(userId:string,kind:Kind,id:string){
  return (await getDb().select().from(records).where(and(eq(records.userId,userId),eq(records.id,id),eq(records.kind,kind))).limit(1))[0];
}
export async function findCreateRequest(userId:string,kind:Kind,requestId:string|undefined,fingerprint:string){
  if(requestId===undefined)return undefined;
  const prior=(await getDb().select().from(records).where(and(eq(records.userId,userId),eq(records.requestId,requestId))).limit(1))[0];
  return matchCreateRequest(prior,kind,fingerprint);
}
export async function insertRecord(userId:string,kind:Kind,data:unknown,requestId:string|undefined,fingerprint:string,via:Via){
  const db=getDb(),now=new Date().toISOString();
  const inserted=await db.insert(records).values({userId,id:crypto.randomUUID(),kind,payload:JSON.stringify(data),requestId,createFingerprint:fingerprint,createdAt:now,updatedAt:now,createdVia:via,updatedVia:via}).onConflictDoNothing({target:[records.userId,records.requestId]}).returning();
  if(inserted[0])return {row:inserted[0],created:true};
  const prior=await findCreateRequest(userId,kind,requestId,fingerprint);
  if(!prior)throw new Error('IDEMPOTENCY_CONFLICT');
  return {row:prior,created:false};
}
export async function updateRecord(userId:string,kind:Kind,id:string,data:unknown,expectedUpdatedAt:string,via:Via){
  const saved=await getDb().update(records).set({payload:JSON.stringify(data),updatedAt:nextUpdatedAt(expectedUpdatedAt),updatedVia:via}).where(and(eq(records.userId,userId),eq(records.id,id),eq(records.kind,kind),eq(records.updatedAt,expectedUpdatedAt))).returning();
  if(saved[0])return saved[0];
  if(!await findRecord(userId,kind,id))throw new Error('NOT_FOUND');
  throw new Error('VERSION_CONFLICT');
}
export async function deleteRecord(userId:string,kind:Kind,id:string){
  const saved=await getDb().delete(records).where(and(eq(records.userId,userId),eq(records.id,id),eq(records.kind,kind))).returning({id:records.id});
  if(!saved.length)throw new Error('NOT_FOUND');
}
