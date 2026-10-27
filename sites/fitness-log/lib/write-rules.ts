export function canonicalJSON(value: unknown): string {
  if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
  if(value!==null && typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonicalJSON(v)).join(',')+'}';
  return JSON.stringify(value);
}
export function nextUpdatedAt(previous:string,now=new Date()):string {
  return new Date(Math.max(now.valueOf(),Date.parse(previous)+1)).toISOString();
}
export function matchCreateRequest<T extends {kind:string;createFingerprint:string|null}>(prior:T|undefined,kind:string,fingerprint:string):T|undefined {
  if(prior && (prior.kind!==kind || prior.createFingerprint!==fingerprint))throw new Error('IDEMPOTENCY_CONFLICT');
  return prior;
}
