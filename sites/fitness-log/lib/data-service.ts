import { schemas } from './model';
import type { Kind, Via } from './model';
import { domainRecord, findCreateRequest, insertRecord, profileExists, updateRecord } from './repository';
import { canonicalJSON } from './write-rules';
function normalizeRecord(kind:Kind,data:unknown){
  const parsed=schemas[kind].parse(data),normalized={...parsed,profileId:parsed.profileId??'self'};
  return normalized;
}
export async function createRecordForUser(userId:string,kind:Kind,data:unknown,requestId:string|undefined,via:Via){
  const normalized=normalizeRecord(kind,data),fingerprint=canonicalJSON(normalized);
  const prior=await findCreateRequest(userId,kind,requestId,fingerprint);
  if(prior)return {record:domainRecord(prior),created:false};
  if(!await profileExists(userId,normalized.profileId))throw new Error('PROFILE_NOT_FOUND');
  const result=await insertRecord(userId,kind,normalized,requestId,fingerprint,via);
  return {record:domainRecord(result.row),created:result.created};
}
export async function updateRecordForUser(userId:string,kind:Kind,id:string,data:unknown,expectedUpdatedAt:string,via:Via){
  const normalized=normalizeRecord(kind,data);
  if(!await profileExists(userId,normalized.profileId))throw new Error('PROFILE_NOT_FOUND');
  return {record:domainRecord(await updateRecord(userId,kind,id,normalized,expectedUpdatedAt,via))};
}
