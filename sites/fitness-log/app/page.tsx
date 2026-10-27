import { requireChatGPTUser } from './chatgpt-auth';
import FitnessApp from './fitness-app';
import { ownerId } from '../lib/owner';
import { ownerAccessStatus } from '../lib/owner-access';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');if(ownerAccessStatus(user.userId,ownerId())!==200)return <main style={{padding:32}}><h1>训练手记</h1><p>仅站点所有者可访问。</p></main>;return <FitnessApp displayName={user.fullName??'我的训练空间'}/>;}
