import { requireChatGPTUser } from '../../chatgpt-auth';
import { ownerAccessStatus } from '../../../lib/owner-access';
import { ownerId } from '../../../lib/owner';
import { authorizationRequest } from '../../../lib/oauth-contract';
import { createPending, getClient } from '../../../lib/oauth-repository';
import { resourceUrl } from '../../../lib/oauth-http';
export const dynamic = 'force-dynamic';
export default async function Authorize({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const raw = await searchParams, params = new URLSearchParams();
  for (const [key,value] of Object.entries(raw)) { if (Array.isArray(value)) return <main style={{padding:32}}>授权参数不能重复。</main>; if (typeof value === 'string') params.set(key,value); }
  const user = await requireChatGPTUser('/oauth/authorize?'+params.toString());
  if (ownerAccessStatus(user.userId,ownerId()) !== 200) return <main style={{padding:32}}><h1>无法授权</h1><p>只有训练手记所有者可以连接 Agent。</p></main>;
  try {
    const client = await getClient(params.get('client_id') || '');
    if (!client) throw new Error('客户端未注册，请返回 Agent 重新连接');
    const data = authorizationRequest(params,JSON.parse(client.redirectUris),resourceUrl());
    const pending = await createPending(user.userId,data);
    return <main style={{maxWidth:560,margin:'64px auto',padding:24}}><h1>连接训练手记</h1><p><strong>{client.name}</strong> 请求访问你的训练数据。</p><p>返回地址：<code style={{overflowWrap:'anywhere'}}>{data.redirectUri}</code></p><ul>{data.scope.split(' ').map(scope=><li key={scope}>{scope==='repnote:read'?'读取训练、计划、身体指标及分析':'创建和更新训练、计划及身体指标（不含删除）'}</li>)}</ul><p>授权后可在训练手记的数据页随时断开连接。</p><form action="/oauth/consent" method="post"><input type="hidden" name="pending" value={pending}/><button className="button primary" name="decision" value="approve">允许连接</button>{' '}<button className="button" name="decision" value="deny">拒绝</button></form></main>;
  } catch (error) { return <main style={{padding:32}}><h1>无法连接</h1><p>{error instanceof Error?error.message:'授权请求无效'}</p></main>; }
}
