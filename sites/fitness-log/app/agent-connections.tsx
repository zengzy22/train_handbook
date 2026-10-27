'use client';
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';

type Grant={id:string;clientName:string;scope:string;createdAt:number;revokedAt:number|null};
export function RecordOrigin({record}:{record:{createdVia:string;updatedVia:string}}) {
  return record.updatedVia==='mcp'?<span className="badge">{record.createdVia==='mcp'?'AI 创建 / 更新':'AI 更新'}</span>:record.createdVia==='mcp'?<span className="badge">AI 创建</span>:null;
}
export default function AgentConnections() {
  const [grants,setGrants]=useState<Grant[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null),[copied,setCopied]=useState(false),[loading,setLoading]=useState(true);
  async function load(){
    try {const r=await fetch('/api/agent-grants',{cache:'no-store'});const data=await r.json() as {grants:Grant[];error?:string};if(!r.ok)throw new Error(data.error||'连接列表读取失败');setGrants(data.grants);setError('');}
    catch(e){setError(e instanceof Error?e.message:'连接列表读取失败');}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function revoke(id:string){
    setBusy(id);
    try {const r=await fetch('/api/agent-grants',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw new Error('断开连接失败');await load();}
    catch(e){setError(e instanceof Error?e.message:'断开连接失败');}finally{setBusy(null);}
  }
  async function copy(){try{await navigator.clipboard.writeText(location.origin+'/agent/mcp');setCopied(true);}catch{setError('无法复制，请手动复制连接地址');}}
  const active=grants.filter(g=>g.revokedAt===null);
  return <section className="panel connect-card agent-connections"><div className="panel-title"><h2>连接 AI</h2><span className="badge">可读写 MCP</span></div><p>在支持远程 MCP 和 OAuth 的 Agent 中添加以下地址，登录你的 ChatGPT 账号后选择允许的权限。只有你能批准连接。</p><div className="endpoint"><code>/agent/mcp</code><button className="button small" onClick={()=>void copy()}><Copy size={14}/>{copied?'已复制':'复制连接地址'}</button></div><p>读取权限用于分析；写入权限用于创建和更新训练、计划及身体指标。删除仍在网页中操作。</p><details className="connection-details"><summary>ChatGPT / Codex 与工具说明</summary><p>原生个人插件继续连接 Repnote，也可使用 <code>/mcp</code>。通用客户端使用上面的地址并完成 OAuth 授权。仅填写地址不会获得数据访问权。</p><p>读取工具：全部快照、资料、训练、计划、身体指标和区间摘要。写入工具：create/update_workout、create/update_training_plan、create/update_body_metric。</p><p>AI 写入前应核对日期、资料、重量和次数。来源会保存在记录中，客户端重试不会重复创建同一请求。</p></details><h3>已授权的连接</h3>{loading?<p>正在读取连接…</p>:active.length?<ul className="agent-grant-list">{active.map(g=><li key={g.id}><div><strong>{g.clientName}</strong><small>{g.scope.split(' ').map(s=>s==='repnote:write'?'写入':'读取').join(' · ')} · {new Date(g.createdAt*1000).toLocaleDateString('zh-CN')}</small></div><button className="button small" disabled={busy===g.id} onClick={()=>void revoke(g.id)}>{busy===g.id?'正在断开…':'断开连接'}</button></li>)}</ul>:<p>还没有外部 Agent 授权。原生插件连接在 ChatGPT/Codex 插件设置中管理。</p>}{error&&<p role="alert" className="import-error">{error}</p>}</section>;
}
