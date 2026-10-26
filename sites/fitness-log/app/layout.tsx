import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Repnote · 训练手记',description:'记录每一组，读懂每一次进步。私人训练日历、计划与数据分析。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
