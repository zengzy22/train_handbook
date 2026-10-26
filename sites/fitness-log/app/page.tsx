import { requireChatGPTUser } from './chatgpt-auth';
import FitnessApp from './fitness-app';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <FitnessApp displayName={user.fullName??'我的训练空间'}/>;}
